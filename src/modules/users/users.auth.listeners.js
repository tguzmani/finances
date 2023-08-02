import { actionOn } from 'easy-peasy'
import { startLoading, stopLoading, setError } from 'common/listeners'

const usersAuthListeners = {
  ...startLoading('readProfile', 'signIn'),
  ...stopLoading('readProfile', 'signIn'),
  ...setError('readProfile', 'signIn'),
}

export default usersAuthListeners
