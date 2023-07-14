import React from 'react'
import useForm from 'layout/hooks/useForm'
import {
  TextField,
  Stack,
  Button,
  Collapse,
  IconButton,
  Typography,
} from '@mui/material'
import { useStoreActions } from 'easy-peasy'
import useToggle from 'layout/hooks/useToggle'
import AddIcon from '@mui/icons-material/Add'
import ClearIcon from '@mui/icons-material/Clear'

const CreateAccountForm = () => {
  const [account, bindCredentials, areFieldsEmpty] = useForm({
    name: '',
    type: '',
    classification: '',
    initialBalance: '',
  })
  const [showForm, toggleShowForm] = useToggle()

  const { createAccount } = useStoreActions(state => state.accounts)

  const handleToggleForm = () => {
    toggleShowForm()
  }

  const handleCreateAccount = () => {
    createAccount(account)
    toggleShowForm()
  }

  const collapseButtonText = showForm ? 'Close' : 'Create Account'

  return (
    <Stack mt={2} spacing={2} alignItems='flex'>
      <Button
        startIcon={showForm ? <ClearIcon /> : <AddIcon />}
        onClick={handleToggleForm}
      >
        {collapseButtonText}
      </Button>

      <Collapse my={1} in={showForm}>
        <Stack spacing={2}>
          <TextField
            fullWidth
            label='Account name'
            {...bindCredentials('name')}
          ></TextField>

          <TextField
            fullWidth
            label='Type'
            {...bindCredentials('type')}
          ></TextField>

          <TextField
            fullWidth
            label='Classification'
            {...bindCredentials('classification')}
          ></TextField>

          <TextField
            fullWidth
            label='Initial Balance'
            {...bindCredentials('initialBalance')}
          ></TextField>

          <Button
            variant='contained'
            disableElevation
            disabled={areFieldsEmpty}
            onClick={handleCreateAccount}
          >
            Create Account
          </Button>
        </Stack>
      </Collapse>
    </Stack>
  )
}

export default CreateAccountForm
