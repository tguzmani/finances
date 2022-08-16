import React from 'react'
import { Stack, IconButton } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'

const AccountsTableRowActions = () => {
  return (
    <Stack direction=' row' spacing={2}>
      <IconButton>
        <DeleteIcon />
      </IconButton>
    </Stack>
  )
}

export default AccountsTableRowActions
