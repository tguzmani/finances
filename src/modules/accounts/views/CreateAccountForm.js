import React from 'react'
import useForm from './../../../layout/hooks/useForm'
import { TextField, Stack, Button } from '@mui/material'

const CreateAccountForm = () => {
  const [account, bindCredentials, areFieldsEmpty] = useForm({
    name: '',
    type: '',
    classification: '',
    initialBalance: '',
  })

  return (
    <>
      <Button>Create Account</Button>
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
      </Stack>
    </>
  )
}

export default CreateAccountForm
