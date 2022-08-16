import { Divider, Typography, Button, TextField, Stack } from '@mui/material'
import React from 'react'
import CreateAccountForm from './CreateAccountForm'
import FindAccountInput from './FindAccountInput'

const AccountsSidePanel = () => {
  return (
    <div>
      <FindAccountInput />

      <Divider />

      <CreateAccountForm />
    </div>
  )
}

export default AccountsSidePanel
