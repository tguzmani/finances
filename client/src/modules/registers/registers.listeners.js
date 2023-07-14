import { startLoading, stopLoading, setError } from 'common/listeners'

const registersListeners = {
  ...startLoading('readRegisters', 'createRegisterFromScript'),
  ...stopLoading('readRegisters', 'createRegisterFromScript'),
  ...setError('readRegisters', 'createRegisterFromScript'),
}

export default registersListeners
