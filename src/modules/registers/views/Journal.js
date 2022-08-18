import React from 'react'
import Register from './Register'
import { useStoreState, useStoreActions } from 'easy-peasy'
import useRead from '../../../layout/hooks/useRead'
import Spinner from '../../../layout/Spinner'

const Journal = ({ preview }) => {
  const { registers, loading } = useStoreState(state => state.registers)
  const { readRegisters } = useStoreActions(state => state.registers)

  useRead(readRegisters)

  if (loading && registers.length === 0) return <Spinner />

  const thisRegisters = preview ? registers.slice(0, 5) : registers

  return (
    <>
      {thisRegisters.map(register => (
        <Register key={register.id} register={register} />
      ))}
    </>
  )
}

export default Journal
