import { List } from '@mui/material'
import React from 'react'
import useSubcategoriesByCategory from '../hooks/useSubcategoriesByCategory'
import SubcategoriesItem from './SubcategoriesItem'

const Subcategories = ({ category }) => {
  const subcategories = useSubcategoriesByCategory(category.id)

  return (
    <>
      {subcategories.map(subcategory => (
        <SubcategoriesItem subcategory={subcategory} />
      ))}
    </>
  )
}

export default Subcategories
