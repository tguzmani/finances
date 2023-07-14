import { Grid, Paper, Stack, styled, Typography } from '@mui/material'
import { Box } from '@mui/system'
import Amount from 'layout/Amount'
import React from 'react'
import useCategoryTotals from '../hooks/useCategoryTotals'

const Circle = styled(Box)(({ theme, backgroundColor }) => ({
  height: theme.spacing(4),
  width: theme.spacing(4),
  backgroundColor: '#' + backgroundColor,
  borderRadius: theme.spacing(2),
}))

const CategoriesItem = ({ category }) => {
  const { categoryTotalDebit } = useCategoryTotals(category)

  return (
    <Box mb={2}>
      <Paper>
        <Stack
          p={2}
          direction='row'
          alignItems='center'
          justifyContent='space-between'
        >
          <Stack direction='row' alignItems='center' spacing={2}>
            <Circle backgroundColor={category.color}></Circle>
            <Typography variant='h5'>{category.name}</Typography>
          </Stack>

          <Typography mvariant='body1'>
            <Amount greyedZeroes value={categoryTotalDebit} />
          </Typography>
        </Stack>
      </Paper>
    </Box>
  )
}

export default CategoriesItem
