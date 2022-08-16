import { useState } from 'react'

const useFeedback = (timeout = 1500) => {
  const [active, setActive] = useState(false)

  const activate = () => {
    setActive(true)
    setTimeout(() => setActive(false), timeout)
  }

  return [active, activate]
}

export default useFeedback
