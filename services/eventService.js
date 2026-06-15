const StudentEvent = require('../models/StudentEvent');

/**
 * Track a student behavior event.
 * Called from controllers whenever a meaningful action occurs.
 * 
 * @param {string} userId - The student's user ID
 * @param {string} taskId - The task ID
 * @param {string} type - Event type (HINT_USED, CHAT_MESSAGE, etc.)
 * @param {object} metadata - Additional data about the event
 */
exports.trackEvent = async (userId, taskId, type, metadata = {}) => {
  try {
    await StudentEvent.create({
      user: userId,
      task: taskId,
      type,
      metadata
    });
  } catch (error) {
    // Event tracking should never break the main flow
    console.error('Event tracking error:', error.message);
  }
};

/**
 * Get all events for a user+task combination.
 * 
 * @param {string} userId
 * @param {string} taskId
 * @param {object} options - { type, limit, sort }
 */
exports.getEvents = async (userId, taskId, options = {}) => {
  const query = { user: userId, task: taskId };
  if (options.type) query.type = options.type;

  return StudentEvent.find(query)
    .sort(options.sort || { createdAt: 1 })
    .limit(options.limit || 500);
};

/**
 * Count events for a user+task (used for cache staleness detection).
 */
exports.countEvents = async (userId, taskId) => {
  return StudentEvent.countDocuments({ user: userId, task: taskId });
};

/**
 * Get event summary statistics for a user+task.
 * Returns counts by event type.
 */
exports.getEventSummary = async (userId, taskId) => {
  const events = await StudentEvent.aggregate([
    { $match: { user: userId, task: taskId } },
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]);

  const summary = {};
  events.forEach(e => { summary[e._id] = e.count; });
  return summary;
};

/**
 * Get all events for a student across all tasks (for overview).
 */
exports.getStudentEvents = async (userId, options = {}) => {
  return StudentEvent.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(options.limit || 100)
    .populate('task', 'title type difficulty');
};
