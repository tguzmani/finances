import React, { useState, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { useStoreActions, useStoreState } from 'easy-peasy'
import {
  Grid,
  IconButton,
  Stack,
  Button,
  Typography,
  Alert,
  LinearProgress,
} from '@mui/material'
import HelpIcon from '@mui/icons-material/Help'
import useToggle from 'layout/hooks/useToggle'
import { dracula } from '@uiw/codemirror-theme-dracula'
import Spinner from 'layout/Spinner'

const RegisterEditor = ({ register, script, setScript, handleEditRegister }) => {
  const { error, loading } = useStoreState(state => state.registers)

  const onChange = (value, viewUpdate) => {
    setScript(value)
  }

  useEffect(() => {
    window.addEventListener('keydown', handleEditRegister)

    return () => window.removeEventListener('keydown', handleEditRegister)
  }, [script])

  const [showHelp, toggleShowHelp] = useToggle()

  const syntaxHelp = [
    'date, [YYYY-MM-DD]',
    'description, [text]',
    'debit, [account], [amount], ([subcategory])',
    'credit, [account], [amount], ([subcategory])',
  ]

  return (
    <Grid container spacing={2} p={2}>
      <Grid item xs={showHelp ? 8 : 12} sx={{ textAlign: 'left' }}>
        <CodeMirror
          height='200px'
          value={script}
          onChange={onChange}
          theme={dracula}
          readOnly={loading}
        />
      </Grid>
      {showHelp && (
        <Grid item xs={4}>
          <Typography gutterBottom variant='h5'>
            Syntax Help
          </Typography>
          {syntaxHelp.map(element => (
            <Typography key={element} variant='body1'>
              {element}
            </Typography>
          ))}
        </Grid>
      )}

      {error && (
        <Grid item xs={12}>
          <Alert variant='outlined' severity='error'>
            {error}
          </Alert>
        </Grid>
      )}

      {loading && (
        <Grid item xs={12}>
          <LinearProgress />
        </Grid>
      )}

      <Grid item xs={12}>
        <Stack
          direction='row'
          justifyContent='space-between'
          alignItems='center'
        >
          <IconButton onClick={toggleShowHelp}>
            <HelpIcon />
          </IconButton>
          <Button disableElevation variant='contained' disabled={script === ''}>
            Update Register
          </Button>
        </Stack>
      </Grid>
    </Grid>
  )
}

export default RegisterEditor
