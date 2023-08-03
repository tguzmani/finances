import { thunk } from 'easy-peasy'
import UsersAuthRepository from './users.auth.repository'

const usersAuthRepository = new UsersAuthRepository()

const usersAuthThunks = {
  readProfile: thunk(async (actions, _, { fail }) => {
    try {
      const user = await usersAuthRepository.readUserById()
      actions.setUser(user)
    } catch (error) {
      fail(error)
    }
  }),

  signIn: thunk(async (actions, credentials, { fail }) => {
    try {
      const user = await usersAuthRepository.signIn(credentials)
      actions.setUser(user)
    } catch (error) {
      fail(error)
    }
  }),

  
  signUp: thunk(async (actions, user, { fail }) => {
    try {
      await usersAuthRepository.signUp(user)
    } catch (error) {
      fail(error)
    }
  }),

  signOut: thunk(async (actions, credentials) => {
    await usersAuthRepository.signOut()
    actions.unsetUser()
  }),
}

export default usersAuthThunks
