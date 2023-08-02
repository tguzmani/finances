import { Paper, Grid, Stack, Typography, Divider } from '@mui/material'
import React from 'react'
import dayjs from 'dayjs'
import RegisterRows from './RegisterRows'
import useSubcategoryById from 'modules/subcategories/hooks/useSubcategoryById'
import SubcategoryIcon from 'modules/subcategories/views/SubcategoryIcon'

const Register = ({ register }) => {
  const { subcategoryId } = register.rows.find(row => row.subcategoryId) || 1
  const { subcategory } = useSubcategoryById(subcategoryId)

  console.log('subcategory', subcategory)

  return (
    <Paper sx={{ margin: '1rem 0' }}>
      <Grid container alignItems='center'>
        <Grid item py={1} xs={1}>
          <Stack>
            <Typography align='center' variant='body2'>
              {dayjs(register.date).format('MMMM')}
            </Typography>
            <Typography align='center' variant='h4'>
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
            <Stack
              direction='row'
              alignItems='center'
              justifyContent='space-between'
            >
              <div />
              <Typography align='center' my={1} variant='body2'>
                {register.description}
              </Typography>
              <SubcategoryIcon subcategory={subcategory} fontSize='small' />
            </Stack>
          </Grid>
        )}
      </Grid>
    </Paper>
  )
}

export default Register
