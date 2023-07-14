const categoriesServices = require('./categories.services')

exports.readCategories = async (req, res) => {
  try {
    const categories = await categoriesServices.readCategories(
      req.userId
    )

    res.send(categories)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.createCategory = async (req, res) => {
  try {
    const category = await categoriesServices.createCategory(
      req.body,
      req.userId
    )
    res.send(category)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.createManyCategories = async (req, res) => {
  try {
    const category = await categoriesServices.createManyCategories(
      req.body,
      req.userId
    )

    res.send(category)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.updateCategory = async (req, res) => {
  const { categoryId } = req.params

  try {
    const category = await categoriesServices.updateCategory(
      categoryId,
      req.body
    )
    res.send(category)
  } catch (error) {
    return res.status(400).send(error.message)
  }
}

exports.deleteCategory = async (req, res) => {
  const { categoryId } = req.params

  try {
    const category = await categoriesServices.deleteCategory(
      categoryId
    )
    res.send(category)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}
