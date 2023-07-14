import React from 'react'
import * as Icons from '@mui/icons-material'

const SubcategoryIcon = ({ subcategory, ...rest }) => {
  if (!subcategory) return <div />

  const Icon = Icons[subcategory?.icon ?? 'Category']

  return (
    <Icon
      sx={{ color: subcategory.category.color, margin: '0.75rem' }}
      {...rest}
    />
  )
}

export default SubcategoryIcon
