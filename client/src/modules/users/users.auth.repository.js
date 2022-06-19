import AxiosRepository from '../../common/axios.repository'
import { readUserById } from './users.auth.actions'

export default class UsersAuthRepository extends AxiosRepository {
  constructor() {
    super('users')
  }

  async signIn(user) {
    return await super.post('/sign-in', user)
  }

  async signOut() {
    return await super.post('/sign-out')
  }

  async signUp(user) {
    return await super.post('/sign-up', user)
  }

  async readUserById() {
    return await super.get('/profile')
  }
}
