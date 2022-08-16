import React from 'react'
import useForm from './../../../layout/hooks/useForm'
import { TextField, Stack, Button, Collapse } from '@mui/material'
import { useStoreActions } from 'easy-peasy'
import useToggle from '../../../layout/hooks/useToggle'

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
    <>
      <Button onClick={handleToggleForm}>{collapseButtonText}</Button>
      <Collapse in={showForm}>
        <Stack spacing={3}>
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

          <Button onClick={handleCreateAccount}>Create Account</Button>
        </Stack>
      </Collapse>
    </>
  )
}

export default CreateAccountForm
