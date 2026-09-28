/** Configuration or usage mistakes the SDK refuses to proceed on. */
export class SuqoConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SuqoConfigError'
  }
}
