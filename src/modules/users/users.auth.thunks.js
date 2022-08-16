import { thunk } from 'easy-peasy'
import UsersAuthRepository from './users.auth.repository'

const usersAuthRepository = new UsersAuthRepository()

const usersAuthThunks = {
  readProfile: thunk(async actions => {
    actions.setLoading(true)

    const user = await usersAuthRepository.readUserById()
    actions.setUser(user)
  }),

  signIn: thunk(async (actions, credentials) => {
    actions.setLoading(true)

    const user = await usersAuthRepository.signIn(credentials)
    actions.setUser(user)
  }),

  signOut: thunk(async (actions, credentials) => {
    await usersAuthRepository.signOut()
    actions.unsetUser()
  }),
}

export default usersAuthThunks
