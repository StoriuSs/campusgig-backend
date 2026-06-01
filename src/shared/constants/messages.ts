export const MESSAGES = {
    // Success messages
    SUCCESS: {
        OPERATION_SUCCESSFUL: 'Operation completed successfully',
        CREATED: 'Resource created successfully',
        UPDATED: 'Resource updated successfully',
        DELETED: 'Resource deleted successfully'
    },

    // Auth messages
    AUTH: {
        LOGIN_SUCCESS: 'Login successful',
        LOGOUT_SUCCESS: 'Logout successful',
        REGISTER_SUCCESS: 'Registration successful. Check your email for verification code.',
        VERIFY_CODE_REGISTER_SUCCESS: 'Code verified successfully. You can now login.',
        VERIFY_CODE_RESET_SUCCESS: 'Code verified successfully. You can now reset your password.',
        TOKEN_REFRESHED: 'Token refreshed successfully',
        INVALID_CREDENTIALS: 'Invalid email or password',
        INVALID_CURRENT_PASSWORD: 'Current password is incorrect',
        UNAUTHORIZED: 'Unauthorized access',
        TOKEN_MISSING: 'Authorization token is required',
        TOKEN_EXPIRED: 'Token has expired',
        TOKEN_INVALID: 'Invalid token',
        TOKEN_REVOKED: 'Token has been revoked',
        EMAIL_ALREADY_EXISTS: 'Email already exists',
        USER_NOT_FOUND: 'User not found',
        VERIFICATION_CODE_INVALID: 'Invalid or expired verification code',
        VERIFICATION_CODE_EXPIRED: 'Verification code has expired',
        REGISTRATION_SESSION_EXPIRED: 'Registration session expired. Please register again.',
        CODE_VERIFIED: 'Code verified',
        PASSWORD_RESET_CODE_SENT: 'Password reset code sent to email',
        CHECK_EMAIL_FOR_RESET_CODE: 'Check your email for the reset code',
        VERIFICATION_CODE_RESENT: 'Verification code resent successfully',
        PASSWORD_RESET_SUCCESS: 'Password has been reset successfully',
        PASSWORD_CHANGED_SUCCESS: 'Password has been changed successfully',
        PASSWORD_SAME_AS_CURRENT: 'New password must be different from current password',
        LOGIN_WITH_NEW_PASSWORD: 'You can now login with your new password',
        EMAIL_NOT_VERIFIED: 'Email not verified. Please verify your email first.',
        ACCOUNT_DISABLED: 'Account is disabled. Please contact support.',
        LOGIN_FAILED: 'Login failed. Please try again.',
        REFRESH_FAILED: 'Failed to refresh token. Please login again.',
        REFRESH_TOKEN_EXPIRED: 'Refresh token has expired. Please login again.',
        FORBIDDEN: 'You do not have permission to perform this action'
    },

    // Validation messages
    VALIDATION: {
        INVALID_EMAIL: 'Invalid email format',
        INVALID_PASSWORD: 'Password must be at least 8 characters',
        REQUIRED_FIELD: 'This field is required',
        INVALID_UUID: 'Invalid UUID format'
    },

    // Error messages
    ERROR: {
        INTERNAL_SERVER_ERROR: 'Internal server error',
        BAD_REQUEST: 'Bad request',
        NOT_FOUND: 'Resource not found',
        FORBIDDEN: 'Access forbidden'
    },

    // File upload messages
    UPLOAD: {
        SUCCESS: 'File uploaded successfully',
        FAILED: 'File upload failed',
        INVALID_FILE_TYPE: 'Invalid file type',
        FILE_TOO_LARGE: 'File size exceeds the limit',
        IMAGE_PROCESSING_FAILED: 'Failed to process image',
        IMAGE_INVALID: 'Invalid or corrupted image file'
    },

    // Email messages
    EMAIL: {
        SENT: 'Email sent successfully',
        FAILED: 'Failed to send email'
    },

    // User messages
    USER: {
        FETCHED: 'User fetched successfully',
        UPDATED: 'User updated successfully',
        DELETED: 'User deleted successfully',
        ACCOUNT_DELETED: 'Account deleted successfully',
        NOT_FOUND: 'User not found',
        PROFILE_UPDATED: 'Profile updated successfully',
        USERNAME_TAKEN: 'Username is already taken. Please choose another.',
        USERNAME_SET_SUCCESS: 'Username set successfully',
        USERNAME_ALREADY_SET: 'Username has already been set and cannot be changed'
    },

    // Category messages (Feature 03)
    CATEGORY: {
        LIST_FETCHED: 'Categories retrieved successfully',
        CREATED: 'Category created successfully',
        UPDATED: 'Category updated successfully',
        DELETED: 'Category deleted successfully'
    },

    // Gig messages (Feature 04)
    GIG: {
        LIST_FETCHED: 'Gigs retrieved successfully',
        FETCHED: 'Gig retrieved successfully',
        CREATED: 'Gig submitted for review',
        UPDATED: 'Gig updated successfully',
        PAUSED: 'Gig paused',
        RESUMED: 'Gig resumed',
        DELETED: 'Gig deleted',
        IMAGE_UPLOADED: 'Image uploaded successfully',
        IMAGE_DELETED: 'Image deleted',
        IMAGES_REORDERED: 'Images reordered',
        // Admin Gig Queue (Feature 05)
        QUEUE_FETCHED: 'Gig queue retrieved successfully',
        APPROVED: 'Gig approved',
        REJECTED: 'Gig rejected',
        // Public Gigs (Feature 06)
        BROWSE_FETCHED: 'Gigs browsed successfully',
        PUBLIC_FETCHED: 'Gig details retrieved successfully',
        // Gig analytics (Feature 11+)
        VIEW_RECORDED: 'View recorded',
        STATS_FETCHED: 'Gig stats retrieved successfully'
    },

    // Wishlist messages (Feature 06)
    WISHLIST: {
        SAVED: 'Gig saved to wishlist',
        UNSAVED: 'Gig removed from wishlist',
        FETCHED: 'Wishlist retrieved successfully'
    },

    // Wallet + Withdrawals messages (Feature 07 + 13)
    WALLET: {
        FETCHED: 'Wallet retrieved successfully',
        TRANSACTIONS_FETCHED: 'Transactions retrieved successfully',
        DEPOSITED: 'Deposit completed',
        WITHDRAW_REQUESTED: 'Withdrawal request submitted',
        BANK_ACCOUNT_UPDATED: 'Bank account updated'
    },
    ADMIN_WITHDRAWALS: {
        LISTED: 'Withdrawals retrieved successfully',
        FETCHED: 'Withdrawal retrieved successfully',
        APPROVED: 'Withdrawal approved',
        REJECTED: 'Withdrawal rejected'
    },

    // Messaging messages (Feature 08)
    MESSAGING: {
        THREAD_CREATED: 'Conversation ready',
        CONVERSATIONS_LISTED: 'Conversations retrieved successfully',
        MESSAGES_LISTED: 'Messages retrieved successfully',
        MESSAGE_SENT: 'Message sent',
        ATTACHMENT_UPLOADED: 'Attachment uploaded',
        THREAD_READ: 'Conversation marked as read',
        UNREAD_COUNT_FETCHED: 'Unread count retrieved',
        FILES_LISTED: 'Files retrieved successfully',
        ATTACHMENT_RESOLVED: 'Download URL ready',
        RESPONSE_TIME_FETCHED: 'Response time retrieved'
    },

    // Orders messages (Feature 09 + 10)
    ORDERS: {
        PLACED: 'Order placed',
        FETCHED: 'Order retrieved',
        LISTED: 'Orders retrieved',
        EVENTS_FETCHED: 'Order events retrieved',
        ACTION_COUNTS_FETCHED: 'Action-required counts retrieved',
        ACCEPTED: 'Order accepted',
        DECLINED: 'Order declined',
        DELIVERED: 'Delivery sent',
        DELIVERY_UPDATED: 'Delivery updated',
        DELIVERIES_LISTED: 'Deliveries retrieved',
        DELIVERY_FILE_STAGED: 'Delivery file uploaded',
        DELIVERY_FILE_RESOLVED: 'Download URL ready',
        DELIVERY_ACCEPTED: 'Delivery accepted',
        EXTENSION_REQUESTED: 'Extension request sent',
        EXTENSION_DECIDED: 'Extension decision recorded',
        CANCELLATION_REQUESTED: 'Cancellation request sent',
        CANCELLATION_DECIDED: 'Cancellation decision recorded'
    },

    // Review messages
    REVIEWS: {
        SUBMITTED: 'Review submitted',
        REPLIED: 'Reply posted',
        LISTED: 'Reviews retrieved',
        SUMMARY_FETCHED: 'Review summary retrieved',
        MANAGE_LISTED: 'Reviews retrieved'
    },

    // Dispute messages (Feature 12)
    DISPUTE: {
        FILED: 'Dispute filed',
        RESPONDED: 'Response submitted',
        EVIDENCE_ADDED: 'Evidence added',
        EVIDENCE_UPLOADED: 'Evidence file uploaded',
        EVIDENCE_URL: 'Evidence URL generated',
        LISTED: 'Disputes retrieved',
        FETCHED: 'Dispute retrieved',
        RESOLVED: 'Verdict submitted'
    },

    // Admin dashboard + remaining pages (Feature 14)
    ADMIN_ACTIVITY: {
        LISTED: 'Activity log retrieved successfully'
    },
    ADMIN_USERS: {
        LISTED: 'Users retrieved successfully',
        FETCHED: 'User detail retrieved successfully',
        ENDORSED: 'User endorsed',
        REVOKED: 'Endorsement revoked',
        NOTE_SAVED: 'Admin note saved'
    },
    ADMIN_DASHBOARD: {
        FETCHED: 'Dashboard metrics retrieved successfully'
    },
    ADMIN_REPORTS: {
        EXPORTS_LISTED: 'Recent exports retrieved successfully'
    },

    // Health messages
    HEALTH: {
        CHECK_SUCCESS: 'Health check successful',
        SERVICE_HEALTHY: 'All services are healthy',
        SERVICE_UNHEALTHY: 'Some services are unhealthy'
    },

    // Cache messages
    CACHE: {
        SET_SUCCESS: 'Cache set successfully',
        GET_SUCCESS: 'Cache retrieved successfully',
        DELETE_SUCCESS: 'Cache deleted successfully',
        CLEAR_SUCCESS: 'Cache cleared successfully',
        NOT_FOUND: 'Cache key not found'
    },

    // Rate limiting messages
    RATE_LIMIT: {
        COOLDOWN_ACTIVE: 'Please wait {seconds} seconds before requesting another code',
        DAILY_LIMIT_EXCEEDED: 'Daily limit exceeded. Please try again tomorrow.'
    }
}

export const HTTP_STATUS_MESSAGES = {
    200: 'OK',
    201: 'Created',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error',
    503: 'Service Unavailable'
}
