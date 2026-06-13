export const cookies = () => ({
  get: (name) => undefined,
  set: (name, value) => {},
  delete: (name) => {},
  getAll: () => [],
})

export const headers = () => new Headers()

export const draftMode = () => ({ isEnabled: false })
