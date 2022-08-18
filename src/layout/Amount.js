import { useStoreState } from 'easy-peasy'
import React from 'react'

const Amount = ({ value }) => {
  const { user } = useStoreState(state => state.auth)

  const valueString =
    '$ ' + (parseFloat(value) === 0 ? '--' : parseFloat(value).toFixed(2))

  return <div>{user.settings.hideAmounts ? ' ******' : valueString}</div>
}

export default Amount
