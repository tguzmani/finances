import { Grid, List } from '@mui/material'
import { useStoreState } from 'easy-peasy'
import PageHeader from 'layout/PageHeader'
import Subcategories from 'modules/subcategories/views/Subcategories'
import React from 'react'
import CategoriesItem from './CategoriesItem'

const Categories = () => {
  const { categories } = useStoreState(state => state.categories)

  return (
    <>
      <PageHeader>Categories</PageHeader>
      <Grid container spacing={4}>
        {categories.map(category => (
          <Grid item xs={4}>
            <CategoriesItem category={category} />
            <Subcategories category={category} />
          </Grid>
        ))}
      </Grid>
    </>
  )
}

export default Categories
