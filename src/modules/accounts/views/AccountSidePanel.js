import DeleteIcon from '@mui/icons-material/Delete'
import {
  Typography,
  Paper,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
} from '@mui/material'
import { useStoreActions, useStoreState } from 'easy-peasy'
import React from 'react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useToggle from 'layout/hooks/useToggle'
import SidePanel from 'layout/SidePanel'

const AccountSidePanel = () => {
  const [showDeleteDialog, toggleShowDeleteDialog] = useToggle()

  const [confirmationString, setConfirmationString] = useState('')

  const { user } = useStoreState(state => state.auth)
  const { accounts } = useStoreState(state => state.accounts)
  const { accountId } = useParams()

  const navigate = useNavigate()

  const { deleteAccount } = useStoreActions(state => state.accounts)

  const thisAccount = accounts.find(account => account.id === Number(accountId))

  const handleToggleDeleteDialog = () => {
    setConfirmationString('')
    toggleShowDeleteDialog()
  }

  const handleDeleteAccount = () => {
    deleteAccount(thisAccount?.id)
    navigate('/accounts')
  }

  const formattedAccountName = thisAccount?.name
    .toLowerCase()
    .replace(/\s/g, '-')

  const deleteAccountConfirmationString = `${user.username}/${formattedAccountName}`

  const stringsMatch = confirmationString === deleteAccountConfirmationString

  return (
    <SidePanel>
      <Typography mb={2} variant='h6'>
        Account Information
      </Typography>

      <Typography mb={3} variant='body1'>
        Account ID: {accountId}
      </Typography>

      <Divider />

      <Typography mb={2} mt={3} variant='h6'>
        Danger Zone
      </Typography>

      <Button
        fullWidth
        variant='outlined'
        startIcon={<DeleteIcon />}
        color='error'
        onClick={handleToggleDeleteDialog}
      >
        Delete Account
      </Button>

      <Dialog open={showDeleteDialog}>
        <DialogTitle>Confirm Delete Account</DialogTitle>
        <DialogContent>
          <DialogContentText my={2}>
            Deleting an account will lead to permanent data loss. Confirm you
            are sure of this operation by writing{' '}
            <strong>{deleteAccountConfirmationString}</strong> in the input
            below
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            onChange={e => setConfirmationString(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleToggleDeleteDialog}>Cancel</Button>
          <Button
            color='error'
            onClick={handleDeleteAccount}
            disabled={!stringsMatch}
          >
            Delete Account
          </Button>
        </DialogActions>
      </Dialog>
    </SidePanel>
  )
}

export default AccountSidePanel
