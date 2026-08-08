import express from 'express';
import {
  initiateConference,
  endConference,
  getActiveConferences,
  getConferenceDetails,
  addScreenToConference,
  removeScreenFromConference,
  updateConferenceSettings
} from '../controllers/videoConference';

const router = express.Router();

// POST /api/v1/video-conference/initiate
router.post('/initiate', initiateConference);

// GET /api/v1/video-conference/active
router.get('/active', getActiveConferences);

// GET /api/v1/video-conference/:conferenceId
router.get('/:conferenceId', getConferenceDetails);

// PATCH /api/v1/video-conference/:conferenceId/settings
router.patch('/:conferenceId/settings', updateConferenceSettings);

// POST /api/v1/video-conference/:conferenceId/add-screen
router.post('/:conferenceId/add-screen', addScreenToConference);

// DELETE /api/v1/video-conference/:conferenceId/remove-screen/:screenId
router.delete('/:conferenceId/remove-screen/:screenId', removeScreenFromConference);

// POST /api/v1/video-conference/:conferenceId/end
router.post('/:conferenceId/end', endConference);

export default router;
