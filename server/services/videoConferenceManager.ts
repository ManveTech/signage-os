import { io as ioClient } from 'socket.io-client';
import { pb } from '../db';

interface ConferenceState {
  conferenceId: string;
  status: 'active' | 'ended';
  participantScreenIds: string[];
  adminWebRTCOffer?: any;
}

const conferenceStates = new Map<string, ConferenceState>();

export async function notifyScreensOfConference(conferenceId: string, targetScreenIds: string[]) {
  try {
    // Broadcast to all connected TV clients via Socket.io
    const io = (global as any).io;
    if (!io) {
      console.warn('[videoConferenceManager] Socket.io not initialized');
      return;
    }

    targetScreenIds.forEach(screenId => {
      io.to(`screen-${screenId}`).emit('conference:initiated', {
        conferenceId,
        mode: 'video-call'
      });
    });

    console.log(`[videoConferenceManager] Notified ${targetScreenIds.length} screens of conference ${conferenceId}`);
  } catch (error) {
    console.error('[videoConferenceManager] Error notifying screens:', error);
  }
}

export async function notifyScreensOfConferenceEnd(conferenceId: string, targetScreenIds: string[]) {
  try {
    const io = (global as any).io;
    if (!io) return;

    targetScreenIds.forEach(screenId => {
      io.to(`screen-${screenId}`).emit('conference:ended', {
        conferenceId
      });
    });

    conferenceStates.delete(conferenceId);
    console.log(`[videoConferenceManager] Notified ${targetScreenIds.length} screens that conference ${conferenceId} ended`);
  } catch (error) {
    console.error('[videoConferenceManager] Error notifying end:', error);
  }
}

export async function broadcastWebRTCSignal(conferenceId: string, fromUserId: string, toScreenId: string, signal: any) {
  try {
    const io = (global as any).io;
    if (!io) return;

    io.to(`screen-${toScreenId}`).emit('webrtc:signal', {
      conferenceId,
      fromUserId,
      signal
    });
  } catch (error) {
    console.error('[videoConferenceManager] Error broadcasting signal:', error);
  }
}

export function registerConferenceState(conferenceId: string, state: ConferenceState) {
  conferenceStates.set(conferenceId, state);
}

export function getConferenceState(conferenceId: string): ConferenceState | undefined {
  return conferenceStates.get(conferenceId);
}

export async function validateScreenCameraEnabled(screenId: string): Promise<boolean> {
  try {
    const screen = await pb.collection('screens').getOne(screenId);
    return screen.cameraMountEnabled === true;
  } catch (error) {
    console.error(`[videoConferenceManager] Error checking camera status for screen ${screenId}:`, error);
    return false;
  }
}
