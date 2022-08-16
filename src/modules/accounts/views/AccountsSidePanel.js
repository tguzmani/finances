import { Divider, Paper } from '@mui/material'
import React from 'react'
import CreateAccountForm from './CreateAccountForm'
import FindAccountInput from './FindAccountInput'

const AccountsSidePanel = () => {
  return (
    <Paper variant='outlined' sx={{ margin: '1rem', padding: '1rem' }}>
      <FindAccountInput />

      <CreateAccountForm />
    </Paper>
  )
}

export default AccountsSidePanel
