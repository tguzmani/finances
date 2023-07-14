import { Divider, Paper } from '@mui/material'
import SidePanel from 'layout/SidePanel'
import React from 'react'
import CreateAccountForm from './CreateAccountForm'
import FindAccountInput from './FindAccountInput'

const AccountsSidePanel = () => {
  return (
    <SidePanel>
      <FindAccountInput />

      <CreateAccountForm />
    </SidePanel>
  )
}

export default AccountsSidePanel
