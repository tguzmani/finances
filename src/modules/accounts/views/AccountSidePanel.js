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
import { useNavigate } from 'react-router-dom'
import useToggle from 'layout/hooks/useToggle'

const AccountSidePanel = ({ account }) => {
  const [showDeleteDialog, toggleShowDeleteDialog] = useToggle()

  const [confirmationString, setConfirmationString] = useState('')

  const { user } = useStoreState(state => state.auth)

  const navigate = useNavigate()

  const { deleteAccount } = useStoreActions(state => state.accounts)

  const handleToggleDeleteDialog = () => {
    setConfirmationString('')
    toggleShowDeleteDialog()
  }

  const handleDeleteAccount = () => {
    deleteAccount(account.id)
    navigate('/accounts')
  }

  const deleteAccountConfirmationString = `${user.username}/${account.name
    .toLowerCase()
    .replace(/\s/g, '-')}`

  const stringsMatch = confirmationString === deleteAccountConfirmationString

  return (
    <Paper variant='outlined' sx={{ margin: '1rem', padding: '1rem' }}>
      <Typography mb={3} variant='body1'>
        Lorem ipsum, dolor sit amet consectetur adipisicing elit. Vel ab
        voluptatibus corporis qui recusandae, quia officiis distinctio alias
        illo earum accusamus iure labore ducimus laborum nemo doloribus dolorum
        quos atque?
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
    </Paper>
  )
}

export default AccountSidePanel
