import { useStoreState } from 'easy-peasy'
import React from 'react'

const Amount = ({ value }) => {
  const { hideAmounts } = useStoreState(state => state.auth)

  const valueString = '$ ' + (parseFloat(value) === 0 ? '--' : value)

  return <div>{hideAmounts ? '******' : valueString}</div>
}

export default Amount
