# Functions
replace () {
  sed -i "s/ENTITY/$uppercase_entity/g" $1
  sed -i "s/ENTITIES/$uppercase_plural_entity/g" $1
  sed -i "s/Entity/$capitalized_entity/g" $1
  sed -i "s/Entities/$capitalized_plural_entity/g" $1
  sed -i "s/entity/$entity/g" $1
  sed -i "s/entities/$plural_entity/g" $1
}


# Initialization
entity=$1
plural_entity=$2

echo "Create columns for $plural_entity:"
read create_columns_input

echo
echo "Update for $plural_entity:"
read update_columns_input


# Variable creations
uppercase_entity=${entity^^}
uppercase_plural_entity=${plural_entity^^}

capitalized_entity=${entity^}
capitalized_plural_entity=${plural_entity^}

mkdir ./src/$plural_entity >/dev/null 2>&1


# Column mappers
sql_create_cols=""
for col in $create_columns_input; do sql_create_cols+="$col, "; done

sql_create_placeholders=""
for col in $create_columns_input; do sql_create_placeholders+="?, "; done

arg_create_cols=""
for col in $create_columns_input; do arg_create_cols+="$col, "; done

comma_create_cols=""
for col in $create_columns_input; do comma_create_cols+="$col, "; done

sql_update_cols=""
for col in $update_columns_input; do sql_update_cols+="$col = ?, "; done

comma_update_cols=""
for col in $update_columns_input; do comma_update_cols+="$col, "; done


# Queries
query_file=./src/$plural_entity/$plural_entity.queries.js
cp ./templates/queries.js $query_file

replace $query_file
sed -i "s/SQL_CREATE_COLS/${sql_create_cols::-2}/g" $query_file
sed -i "s/SQL_CREATE_PLACEHOLDERS/${sql_create_placeholders::-2}/g" $query_file
sed -i "s/SQL_UPDATE_COLS/${sql_update_cols::-2}/g" $query_file


# Repository
repository_file=./src/$plural_entity/$plural_entity.repository.js
cp ./templates/repository.js $repository_file

replace $repository_file
sed -i "s/ARG_CREATE_COLS/(${arg_create_cols::-2})/g" $repository_file
sed -i "s/COMMA_CREATE_COLS/${comma_create_cols::-2}/g" $repository_file
sed -i "s/COMMA_UPDATE_COLS/${comma_update_cols::-2}/g" $repository_file


# Services
services_file=./src/$plural_entity/$plural_entity.services.js
cp ./templates/services.js $services_file

replace $services_file
sed -i "s/ARG_CREATE_COLS/(${arg_create_cols::-2})/g" $services_file
sed -i "s/COMMA_CREATE_COLS/${comma_create_cols::-2}/g" $services_file
sed -i "s/COMMA_UPDATE_COLS/${comma_update_cols::-2}/g" $services_file


# Controller
controller_file=./src/$plural_entity/$plural_entity.controller.js
cp ./templates/controller.js $controller_file

replace $controller_file
sed -i "s/ARG_CREATE_COLS/(${arg_create_cols::-2})/g" $controller_file
sed -i "s/COMMA_CREATE_COLS/${comma_create_cols::-2}/g" $controller_file
sed -i "s/COMMA_UPDATE_COLS/${comma_update_cols::-2}/g" $controller_file


# Routes
routes_file=./src/$plural_entity/$plural_entity.routes.js
cp ./templates/routes.js $routes_file

replace $routes_file


# Feedback
echo
echo "$capitalized_entity files created successfully"
echo "Don't forget to add '$plural_entity' to app.js"