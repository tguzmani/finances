const subcategoriesServices = require('./subcategories.services')

exports.readSubcategories = async (req, res) => {
  try {
    const subcategories = await subcategoriesServices.readSubcategories(
      req.userId
    )

    res.send(subcategories)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.createSubcategory = async (req, res) => {
  try {
    const subcategory = await subcategoriesServices.createSubcategory(
      req.body,
      req.userId
    )
    res.send(subcategory)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.createManySubcategories = async (req, res) => {
  try {
    const subcategory = await subcategoriesServices.createManySubcategories(
      req.body,
      req.userId
    )

    res.send(subcategory)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.updateSubcategory = async (req, res) => {
  const { subcategoryId } = req.params

  try {
    const subcategory = await subcategoriesServices.updateSubcategory(
      subcategoryId,
      req.body
    )
    res.send(subcategory)
  } catch (error) {
    return res.status(400).send(error.message)
  }
}

exports.deleteSubcategory = async (req, res) => {
  const { subcategoryId } = req.params

  try {
    const subcategory = await subcategoriesServices.deleteSubcategory(
      subcategoryId
    )
    res.send(subcategory)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}
