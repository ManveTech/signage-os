import { z } from 'zod';

// Common validation schemas
export const emailSchema = z.string().email('Invalid email address');
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
export const idSchema = z.string().length(15, 'Invalid ID format');

// Auth schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
});

export const forgotPasswordSchema = z.object({
  email: emailSchema
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  userId: idSchema,
  password: passwordSchema
});

// User schemas
export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1, 'Name is required').max(100),
  role: z.enum(['admin', 'super_admin', 'client']).default('client'),
  company: z.string().optional()
});

export const updateUserSchema = z.object({
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'super_admin', 'client']).optional(),
  company: z.string().optional(),
  firstTimeLogin: z.boolean().optional()
});

// Screen schemas
export const createScreenSchema = z.object({
  name: z.string().min(1, 'Screen name is required').max(100),
  status: z.enum(['online', 'offline', 'warning', 'active', 'suspended', 'pairing']).default('pairing'),
  location: z.string().min(1, 'Location is required').max(200),
  licenseType: z.string().optional(),
  assignedToUserEmail: emailSchema.optional()
});

export const updateScreenSchema = createScreenSchema.partial();

// Media schemas
export const createMediaSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  type: z.enum(['image', 'video', 'layout', 'ticker']),
  duration: z.number().min(0).max(3600),
  resolution: z.string().optional(),
  fileSize: z.string().optional(),
  fileSizeBytes: z.number().min(0),
  uploadedBy: z.string().min(1),
  tags: z.array(z.string()).default([]),
  thumbnail: z.string().optional(),
  fileUrl: z.string().url().optional(),
  fileData: z.string().optional(),
  mimeType: z.string().optional()
});

// Playlist schemas
export const createPlaylistSchema = z.object({
  name: z.string().min(1, 'Playlist name is required').max(200),
  mediaIds: z.array(z.string()).default([]),
  assignedScreenIds: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  scheduleStatus: z.enum(['Running', 'Scheduled', 'Paused']).default('Running'),
  createdBy: z.string().min(1),
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  transition: z.enum(['fade', 'slide', 'zoom', 'slide-up', 'slide-down', 'flip', 'spin', 'blur', 'bounce', 'wipe']).optional(),
  shuffle: z.boolean().optional(),
  loop: z.boolean().optional(),
  volume: z.number().min(0).max(100).optional()
});

// License schemas
export const createLicenseSchema = z.object({
  name: z.string().min(1, 'License name is required').max(200),
  assignedOrgId: idSchema.optional(),
  assignedOrgName: z.string().optional(),
  assignedUserEmail: emailSchema.optional(),
  price: z.number().min(0),
  tenure: z.enum(['monthly', 'yearly']),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  storageLimit: z.number().min(0),
  deviceLimit: z.number().min(1),
  whiteLabel: z.boolean().optional()
});

// Organization schemas
export const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(200),
  email: emailSchema.optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  customDomain: z.string().optional(),
  websiteLogo: z.string().optional(),
  websiteName: z.string().optional()
});

// Payment schemas
export const createPaymentSchema = z.object({
  licenseId: idSchema,
  licenseName: z.string().min(1),
  clientName: z.string().min(1),
  clientEmail: emailSchema,
  amount: z.number().min(0),
  razorpayPaymentId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  status: z.enum(['success', 'failed']).default('success')
});

// Support schemas
export const createTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  clientEmail: emailSchema,
  clientName: z.string().min(1)
});

export const updateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
  subject: z.string().max(200).optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional()
});

// Query parameter schemas
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('50'),
  sort: z.string().optional(),
  filter: z.string().optional()
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateScreenInput = z.infer<typeof createScreenSchema>;
export type UpdateScreenInput = z.infer<typeof updateScreenSchema>;
export type CreateMediaInput = z.infer<typeof createMediaSchema>;
export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>;
export type CreateLicenseInput = z.infer<typeof createLicenseSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
