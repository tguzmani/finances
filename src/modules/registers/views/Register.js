import {
  Paper,
  Grid,
  Stack,
  Typography,
  Divider,
  Box,
  IconButton,
} from '@mui/material'
import React, { useState } from 'react'
import dayjs from 'dayjs'
import RegisterRows from './RegisterRows'
import useSubcategoryById from 'modules/subcategories/hooks/useSubcategoryById'
import SubcategoryIcon from 'modules/subcategories/views/SubcategoryIcon'
import { Edit } from '@mui/icons-material'
import RegisterEditor from './RegisterEditor'
import { useStoreActions } from 'easy-peasy'

const Register = ({ register }) => {
  const { subcategoryId } = register.rows.find(row => row.subcategoryId) || 1
  const { subcategory } = useSubcategoryById(subcategoryId)
  const [script, setScript] = useState(register.script)

  const [showEditor, setShowEditor] = React.useState(false)
  const { updateRegisterFromScript } = useStoreActions(state => state.registers)

  const handleShowEditor = () => {
    setShowEditor(true)
  }

  const handleEditRegister = e => {
    if (e.ctrlKey && e.key === 'Enter') {
      const condensedScript = script.replace(/\n{2,}/g, '\n')

      const updateRegisterFromScriptDto = {
        registerId: register.id,
        script: condensedScript,
        oldRows: register.rows,
      }

      updateRegisterFromScript(updateRegisterFromScriptDto)
      setShowEditor(false)
      setScript(condensedScript)
    }
  }

  return (
    <Paper sx={{ margin: '1rem 0' }}>
      <Grid container alignItems='center'>
        <Grid item py={2} xs={1}>
          <Stack>
            <Typography align='center' variant='body2'>
              {dayjs(register.date).format('MMMM')}
            </Typography>
            <Typography align='center' variant='h5'>
              {dayjs(register.date).format('DD')}
            </Typography>
          </Stack>
        </Grid>
        <Grid item xs={11}>
          <RegisterRows rows={register.rows} />
        </Grid>

        {register.description && (
          <Grid item xs={12}>
            <Divider />
            <Grid
              container
              direction='row'
              alignItems='center'
              justifyContent='space-between'
              px={1}
            >
              <Grid item xs={2} sx={{ pl: 1 }}>
                <Stack direction='row'>
                  <Typography variant='caption'># {register.id}</Typography>
                  {subcategory && (
                    <SubcategoryIcon
                      subcategory={subcategory}
                      fontSize='small'
                    />
                  )}
                </Stack>
              </Grid>

              <Grid item xs={8}>
                <Typography align='center' pt={1} pb={1.5} variant='body2'>
                  {register.description}
                </Typography>
              </Grid>

              <Grid item xs={2}>
                <Stack direction='row' spacing={1} justifyContent='flex-end'>
                  <IconButton onClick={handleShowEditor}>
                    <Edit fontSize='small' />
                  </IconButton>
                </Stack>
              </Grid>

              <Box />
            </Grid>
          </Grid>
        )}

        {showEditor && (
          <RegisterEditor
            register={register}
            script={script}
            setScript={setScript}
            handleEditRegister={handleEditRegister}
          />
        )}
      </Grid>
    </Paper>
  )
}

export default Register
