/**
 * Base class for AI providers (Strategy pattern). Business logic depends only
 * on this interface, so providers can be swapped without touching controllers.
 */
export class AIProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * @param {Object} config
   * @param {string} config.targetRole
   * @param {string[]} config.topics
   * @param {'Easy'|'Medium'|'Hard'} config.difficulty
   * @param {'Technical'|'HR'|'Behavioral'|'Mixed'} config.interviewType
   * @param {string} config.experienceLevel
   * @param {number} config.questionCount
   * @returns {Promise<{ questions: Array, provider: string, isFallback: boolean }>}
   */
  // eslint-disable-next-line no-unused-vars
  async generateQuestions(config, options) {
    throw new Error('generateQuestions() must be implemented by a concrete AI provider');
  }

  /**
   * Returns a raw evaluation object; AIServiceManager normalizes it.
   * @param {Object} data - question text, reference concepts, criteria, candidate answer, topic, difficulty, type
   */
  // eslint-disable-next-line no-unused-vars
  async evaluateAnswer(data, options) {
    throw new Error('evaluateAnswer() must be implemented by a concrete AI provider');
  }
}
