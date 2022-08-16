import { useState } from 'react'

const useSelectionList = initialState => {
  const [selected, setSelected] = useState(initialState)

  const toggleSelected = element => e => {
    if (selected.includes(element)) {
      setSelected(selected.filter(section => section !== element))
    } else {
      setSelected([element, ...selected])
    }
  }

  return [selected, toggleSelected]
}

export default useSelectionList
