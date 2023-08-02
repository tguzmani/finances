import { Typography, TextField, Stack } from '@mui/material'
import { useStoreActions } from 'easy-peasy'
import React from 'react'
import { useEffect } from 'react'

const FindAccountInput = () => {
  const [lookupValue, setLookupValue] = React.useState('')
  const { filterAccounts } = useStoreActions(state => state.accounts)

  useEffect(() => {
    filterAccounts('')
  }, [])

  const onChange = e => {
    setLookupValue(e.target.value)
    filterAccounts(e.target.value)
  }

  return (
    <Stack spacing={2}>
      <Typography variant='h6'>Find Account</Typography>
      <TextField
        fullWidth
        label='Search'
        value={lookupValue}
        onChange={onChange}
      ></TextField>
    </Stack>
  )
}

export default FindAccountInput
