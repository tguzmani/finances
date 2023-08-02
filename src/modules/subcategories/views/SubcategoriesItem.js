import { ListItemText, Stack, Typography } from '@mui/material'
import React from 'react'

import useSubcategoryTotals from '../hooks/useSubcategoryTotals'
import { Box } from '@mui/system'
import Amount from 'layout/Amount'
import SubcategoryIcon from './SubcategoryIcon'

const SubcategoriesItem = ({ subcategory }) => {
  const { subcategoryTotalDebit, subcategoryDebits } =
    useSubcategoryTotals(subcategory)

  return (
    <Box p={1}>
      <Stack direction='row' alignItems='center' justifyContent='space-between'>
        <Stack direction='row' alignItems='center' spacing={3}>
          <SubcategoryIcon subcategory={subcategory} />
          <ListItemText>{subcategory.name}</ListItemText>
        </Stack>

        <Typography variant='body2'>
          <Amount greyedZeroes value={subcategoryTotalDebit} />
        </Typography>
      </Stack>
    </Box>
  )
}

export default SubcategoriesItem
