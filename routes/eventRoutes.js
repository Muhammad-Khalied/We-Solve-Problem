const router = require('express').Router();
const auth = require('../middleware/auth');
const { trackEvent } = require('../services/eventService');

// @desc    Track a frontend-triggered event (TASK_OPENED, TASK_CLOSED)
// @route   POST /api/events/track
// @access  Private
router.post('/track', auth, async (req, res, next) => {
  try {
    const { taskId, type, metadata } = req.body;

    // Only allow specific frontend event types
    const allowedTypes = ['TASK_OPENED', 'TASK_CLOSED'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ message: `Invalid event type. Allowed: ${allowedTypes.join(', ')}` });
    }

    if (!taskId) {
      return res.status(400).json({ message: 'taskId is required' });
    }

    await trackEvent(req.user._id, taskId, type, metadata || {});
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
