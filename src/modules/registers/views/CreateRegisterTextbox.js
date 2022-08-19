import React, { useState, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { useStoreActions } from 'easy-peasy'
import {
  Grid,
  IconButton,
  Stack,
  Button,
  Paper,
  Typography,
} from '@mui/material'
import HelpIcon from '@mui/icons-material/Help'
import useToggle from 'layout/hooks/useToggle'

const CreateRegisterTextbox = () => {
  const [script, setScript] = useState('')

  const { createRegisterFromScript } = useStoreActions(state => state.registers)

  const onChange = (value, viewUpdate) => {
    setScript(value)
  }

  useEffect(() => {
    const handleSubmit = e => {
      if (e.ctrlKey && e.key === 'Enter') createRegisterFromScript(script)
    }

    window.addEventListener('keydown', handleSubmit)

    return () => window.removeEventListener('keydown', handleSubmit)
  }, [script])

  const [showHelp, toggleShowHelp] = useToggle()

  const syntaxHelp = [
    'date, [YYYY-MM-DD]',
    'description, [text]',
    'debit, [account], [amount], ([subcategory])',
    'credit, [account], [amount], ([subcategory])',
  ]

  return (
    <Grid container spacing={2}>
      <Grid item xs={showHelp ? 8 : 12}>
        <CodeMirror height='200px' value={script} onChange={onChange} />
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

      <Grid item xs={12}>
        <Stack direction='row' justifyContent='space-between'>
          <IconButton onClick={toggleShowHelp}>
            <HelpIcon />
          </IconButton>
          <Button disableElevation variant='contained' disabled={script === ''}>
            Create Register
          </Button>
        </Stack>
      </Grid>
    </Grid>
  )
}

export default CreateRegisterTextbox
