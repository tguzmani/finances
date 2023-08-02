import React from 'react'
import { useStoreActions } from 'easy-peasy'
import useRead from 'layout/hooks/useRead'
import Categories from 'modules/categories/views/Categories'
import PageWithSidePanel from 'layout/pages/PageWithSidePanel'

const CategoriesPage = () => {
  const { readRegisters } = useStoreActions(state => state.registers)
  const { readCategories } = useStoreActions(state => state.categories)
  const { readSubcategories } = useStoreActions(state => state.subcategories)

  useRead(readCategories, readSubcategories, readRegisters)

  return (
    <PageWithSidePanel SidePanel={'div'}>
      <Categories />
    </PageWithSidePanel>
  )
}

export default CategoriesPage
