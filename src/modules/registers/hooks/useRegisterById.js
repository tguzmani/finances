import { useStoreState } from 'easy-peasy'

const useRegisterById = registerId => {
  const { registers } = useStoreState(state => state.registers)

  const register = registers.find(register => register.id === registerId)

  return { register }
}

export default useRegisterById
