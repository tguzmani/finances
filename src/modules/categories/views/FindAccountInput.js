import { Typography, TextField } from '@mui/material'
import { useStoreActions } from 'easy-peasy'
import React from 'react'

const FindAccountInput = () => {
  const [lookupValue, setLookupValue] = React.useState('')
  const { filterAccounts } = useStoreActions(state => state.accounts)

  const onChange = e => {
    setLookupValue(e.target.value)
    filterAccounts(e.target.value)
  }

  return (
    <>
      <Typography variant='h6'>Find Account</Typography>
      <TextField
        fullWidth
        label='Search'
        value={lookupValue}
        onChange={onChange}
      ></TextField>
    </>
  )
}

export default FindAccountInput
