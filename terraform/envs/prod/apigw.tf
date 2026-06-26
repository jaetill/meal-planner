# REST API: MealPlannerAPI (e2h43o5aje)

resource "aws_api_gateway_rest_api" "mp_rest" {
  name             = "MealPlannerAPI"
  api_key_source   = "HEADER"
  endpoint_configuration {
    types = ["EDGE"]
  }
}

resource "aws_api_gateway_authorizer" "mp_rest_cognitoauth" {
  name            = "CognitoAuth"
  rest_api_id     = aws_api_gateway_rest_api.mp_rest.id
  type            = "COGNITO_USER_POOLS"
  provider_arns   = ["arn:aws:cognito-idp:${var.aws_region}:${data.aws_caller_identity.current.account_id}:userpool/us-east-2_xneeJzaDJ"]
  identity_source = "method.request.header.Authorization"
}

resource "aws_api_gateway_resource" "mp_rest_groups" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  parent_id   = aws_api_gateway_rest_api.mp_rest.root_resource_id
  path_part   = "groups"
}

resource "aws_api_gateway_method" "mp_rest_groups_get" {
  rest_api_id   = aws_api_gateway_rest_api.mp_rest.id
  resource_id   = aws_api_gateway_resource.mp_rest_groups.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.mp_rest_cognitoauth.id
  api_key_required = false
}

resource "aws_api_gateway_integration" "mp_rest_groups_get" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_groups.id
  http_method = aws_api_gateway_method.mp_rest_groups_get.http_method
  type        = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:meal-planner-groups/invocations"
  integration_http_method = "POST"
  passthrough_behavior    = "WHEN_NO_MATCH"
  timeout_milliseconds    = 29000
  cache_namespace         = "0dk12u"
  cache_key_parameters    = []
}

resource "aws_api_gateway_method" "mp_rest_groups_options" {
  rest_api_id   = aws_api_gateway_rest_api.mp_rest.id
  resource_id   = aws_api_gateway_resource.mp_rest_groups.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  api_key_required = false
}

resource "aws_api_gateway_integration" "mp_rest_groups_options" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_groups.id
  http_method = aws_api_gateway_method.mp_rest_groups_options.http_method
  type        = "MOCK"
  passthrough_behavior    = "WHEN_NO_MATCH"
  timeout_milliseconds    = 29000
  cache_namespace         = "0dk12u"
  cache_key_parameters    = []
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "mp_rest_groups_options_200" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_groups.id
  http_method = aws_api_gateway_method.mp_rest_groups_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = false
    "method.response.header.Access-Control-Allow-Methods" = false
    "method.response.header.Access-Control-Allow-Origin" = false
  }
}

resource "aws_api_gateway_integration_response" "mp_rest_groups_options_200" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_groups.id
  http_method = aws_api_gateway_method.mp_rest_groups_options.http_method
  status_code = aws_api_gateway_method_response.mp_rest_groups_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin" = "'https://meals.jaetill.com'"
  }
  depends_on = [aws_api_gateway_integration.mp_rest_groups_options]
}

resource "aws_api_gateway_method" "mp_rest_groups_post" {
  rest_api_id   = aws_api_gateway_rest_api.mp_rest.id
  resource_id   = aws_api_gateway_resource.mp_rest_groups.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.mp_rest_cognitoauth.id
  api_key_required = false
}

resource "aws_api_gateway_integration" "mp_rest_groups_post" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_groups.id
  http_method = aws_api_gateway_method.mp_rest_groups_post.http_method
  type        = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:meal-planner-groups/invocations"
  integration_http_method = "POST"
  passthrough_behavior    = "WHEN_NO_MATCH"
  timeout_milliseconds    = 29000
  cache_namespace         = "0dk12u"
  cache_key_parameters    = []
}

resource "aws_api_gateway_resource" "mp_rest_import" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  parent_id   = aws_api_gateway_rest_api.mp_rest.root_resource_id
  path_part   = "import"
}

resource "aws_api_gateway_method" "mp_rest_import_options" {
  rest_api_id   = aws_api_gateway_rest_api.mp_rest.id
  resource_id   = aws_api_gateway_resource.mp_rest_import.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  api_key_required = false
}

resource "aws_api_gateway_integration" "mp_rest_import_options" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_import.id
  http_method = aws_api_gateway_method.mp_rest_import_options.http_method
  type        = "MOCK"
  passthrough_behavior    = "WHEN_NO_MATCH"
  timeout_milliseconds    = 29000
  cache_namespace         = "94o61z"
  cache_key_parameters    = []
  request_templates = {
    "application/json" = "{\"statusCode\":200}"
  }
}

resource "aws_api_gateway_method_response" "mp_rest_import_options_200" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_import.id
  http_method = aws_api_gateway_method.mp_rest_import_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = false
    "method.response.header.Access-Control-Allow-Methods" = false
    "method.response.header.Access-Control-Allow-Origin" = false
  }
}

resource "aws_api_gateway_integration_response" "mp_rest_import_options_200" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_import.id
  http_method = aws_api_gateway_method.mp_rest_import_options.http_method
  status_code = aws_api_gateway_method_response.mp_rest_import_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin" = "'https://meals.jaetill.com'"
  }
  depends_on = [aws_api_gateway_integration.mp_rest_import_options]
}

resource "aws_api_gateway_method" "mp_rest_import_post" {
  rest_api_id   = aws_api_gateway_rest_api.mp_rest.id
  resource_id   = aws_api_gateway_resource.mp_rest_import.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.mp_rest_cognitoauth.id
  api_key_required = false
}

resource "aws_api_gateway_integration" "mp_rest_import_post" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_import.id
  http_method = aws_api_gateway_method.mp_rest_import_post.http_method
  type        = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:MealPlannerSave/invocations"
  integration_http_method = "POST"
  passthrough_behavior    = "WHEN_NO_MATCH"
  timeout_milliseconds    = 29000
  cache_namespace         = "94o61z"
  cache_key_parameters    = []
}

resource "aws_api_gateway_resource" "mp_rest_share" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  parent_id   = aws_api_gateway_rest_api.mp_rest.root_resource_id
  path_part   = "share"
}

resource "aws_api_gateway_method" "mp_rest_share_options" {
  rest_api_id   = aws_api_gateway_rest_api.mp_rest.id
  resource_id   = aws_api_gateway_resource.mp_rest_share.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  api_key_required = false
}

resource "aws_api_gateway_integration" "mp_rest_share_options" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_share.id
  http_method = aws_api_gateway_method.mp_rest_share_options.http_method
  type        = "MOCK"
  passthrough_behavior    = "WHEN_NO_MATCH"
  timeout_milliseconds    = 29000
  cache_namespace         = "a4o679"
  cache_key_parameters    = []
  request_templates = {
    "application/json" = "{\"statusCode\":200}"
  }
}

resource "aws_api_gateway_method_response" "mp_rest_share_options_200" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_share.id
  http_method = aws_api_gateway_method.mp_rest_share_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = false
    "method.response.header.Access-Control-Allow-Methods" = false
    "method.response.header.Access-Control-Allow-Origin" = false
  }
}

resource "aws_api_gateway_integration_response" "mp_rest_share_options_200" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_share.id
  http_method = aws_api_gateway_method.mp_rest_share_options.http_method
  status_code = aws_api_gateway_method_response.mp_rest_share_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin" = "'https://meals.jaetill.com'"
  }
  depends_on = [aws_api_gateway_integration.mp_rest_share_options]
}

resource "aws_api_gateway_method" "mp_rest_share_post" {
  rest_api_id   = aws_api_gateway_rest_api.mp_rest.id
  resource_id   = aws_api_gateway_resource.mp_rest_share.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.mp_rest_cognitoauth.id
  api_key_required = false
}

resource "aws_api_gateway_integration" "mp_rest_share_post" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_share.id
  http_method = aws_api_gateway_method.mp_rest_share_post.http_method
  type        = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:meal-planner-share/invocations"
  integration_http_method = "POST"
  passthrough_behavior    = "WHEN_NO_MATCH"
  timeout_milliseconds    = 29000
  cache_namespace         = "a4o679"
  cache_key_parameters    = []
}

resource "aws_api_gateway_resource" "mp_rest_save" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  parent_id   = aws_api_gateway_rest_api.mp_rest.root_resource_id
  path_part   = "save"
}

resource "aws_api_gateway_method" "mp_rest_save_options" {
  rest_api_id   = aws_api_gateway_rest_api.mp_rest.id
  resource_id   = aws_api_gateway_resource.mp_rest_save.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  api_key_required = false
}

resource "aws_api_gateway_integration" "mp_rest_save_options" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_save.id
  http_method = aws_api_gateway_method.mp_rest_save_options.http_method
  type        = "MOCK"
  passthrough_behavior    = "WHEN_NO_MATCH"
  timeout_milliseconds    = 29000
  cache_namespace         = "dbv9qk"
  cache_key_parameters    = []
  request_templates = {
    "application/json" = "{\"statusCode\":200}"
  }
}

resource "aws_api_gateway_method_response" "mp_rest_save_options_200" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_save.id
  http_method = aws_api_gateway_method.mp_rest_save_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = false
    "method.response.header.Access-Control-Allow-Methods" = false
    "method.response.header.Access-Control-Allow-Origin" = false
  }
}

resource "aws_api_gateway_integration_response" "mp_rest_save_options_200" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_save.id
  http_method = aws_api_gateway_method.mp_rest_save_options.http_method
  status_code = aws_api_gateway_method_response.mp_rest_save_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin" = "'https://meals.jaetill.com'"
  }
  depends_on = [aws_api_gateway_integration.mp_rest_save_options]
}

resource "aws_api_gateway_method" "mp_rest_save_post" {
  rest_api_id   = aws_api_gateway_rest_api.mp_rest.id
  resource_id   = aws_api_gateway_resource.mp_rest_save.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.mp_rest_cognitoauth.id
  api_key_required = false
}

resource "aws_api_gateway_integration" "mp_rest_save_post" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_save.id
  http_method = aws_api_gateway_method.mp_rest_save_post.http_method
  type        = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:MealPlannerSave/invocations"
  integration_http_method = "POST"
  passthrough_behavior    = "WHEN_NO_MATCH"
  timeout_milliseconds    = 29000
  cache_namespace         = "dbv9qk"
  cache_key_parameters    = []
}

resource "aws_api_gateway_resource" "mp_rest_cook" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  parent_id   = aws_api_gateway_rest_api.mp_rest.root_resource_id
  path_part   = "cook"
}

resource "aws_api_gateway_method" "mp_rest_cook_options" {
  rest_api_id   = aws_api_gateway_rest_api.mp_rest.id
  resource_id   = aws_api_gateway_resource.mp_rest_cook.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  api_key_required = false
}

resource "aws_api_gateway_integration" "mp_rest_cook_options" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_cook.id
  http_method = aws_api_gateway_method.mp_rest_cook_options.http_method
  type        = "MOCK"
  passthrough_behavior    = "WHEN_NO_MATCH"
  timeout_milliseconds    = 29000
  cache_namespace         = "ei8ozv"
  cache_key_parameters    = []
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "mp_rest_cook_options_200" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_cook.id
  http_method = aws_api_gateway_method.mp_rest_cook_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = false
    "method.response.header.Access-Control-Allow-Methods" = false
    "method.response.header.Access-Control-Allow-Origin" = false
  }
}

resource "aws_api_gateway_integration_response" "mp_rest_cook_options_200" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_cook.id
  http_method = aws_api_gateway_method.mp_rest_cook_options.http_method
  status_code = aws_api_gateway_method_response.mp_rest_cook_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin" = "'https://meals.jaetill.com'"
  }
  depends_on = [aws_api_gateway_integration.mp_rest_cook_options]
}

resource "aws_api_gateway_method" "mp_rest_cook_post" {
  rest_api_id   = aws_api_gateway_rest_api.mp_rest.id
  resource_id   = aws_api_gateway_resource.mp_rest_cook.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.mp_rest_cognitoauth.id
  api_key_required = false
}

resource "aws_api_gateway_integration" "mp_rest_cook_post" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_cook.id
  http_method = aws_api_gateway_method.mp_rest_cook_post.http_method
  type        = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:MealPlannerSave/invocations"
  integration_http_method = "POST"
  passthrough_behavior    = "WHEN_NO_MATCH"
  timeout_milliseconds    = 29000
  cache_namespace         = "ei8ozv"
  cache_key_parameters    = []
}

resource "aws_api_gateway_resource" "mp_rest_plan" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  parent_id   = aws_api_gateway_rest_api.mp_rest.root_resource_id
  path_part   = "plan"
}

resource "aws_api_gateway_method" "mp_rest_plan_options" {
  rest_api_id   = aws_api_gateway_rest_api.mp_rest.id
  resource_id   = aws_api_gateway_resource.mp_rest_plan.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  api_key_required = false
}

resource "aws_api_gateway_integration" "mp_rest_plan_options" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_plan.id
  http_method = aws_api_gateway_method.mp_rest_plan_options.http_method
  type        = "MOCK"
  passthrough_behavior    = "WHEN_NO_MATCH"
  timeout_milliseconds    = 29000
  cache_namespace         = "na23ga"
  cache_key_parameters    = []
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "mp_rest_plan_options_200" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_plan.id
  http_method = aws_api_gateway_method.mp_rest_plan_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = false
    "method.response.header.Access-Control-Allow-Methods" = false
    "method.response.header.Access-Control-Allow-Origin" = false
  }
}

resource "aws_api_gateway_integration_response" "mp_rest_plan_options_200" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_plan.id
  http_method = aws_api_gateway_method.mp_rest_plan_options.http_method
  status_code = aws_api_gateway_method_response.mp_rest_plan_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin" = "'https://meals.jaetill.com'"
  }
  depends_on = [aws_api_gateway_integration.mp_rest_plan_options]
}

resource "aws_api_gateway_method" "mp_rest_plan_post" {
  rest_api_id   = aws_api_gateway_rest_api.mp_rest.id
  resource_id   = aws_api_gateway_resource.mp_rest_plan.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.mp_rest_cognitoauth.id
  api_key_required = false
}

resource "aws_api_gateway_integration" "mp_rest_plan_post" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  resource_id = aws_api_gateway_resource.mp_rest_plan.id
  http_method = aws_api_gateway_method.mp_rest_plan_post.http_method
  type        = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:meal-planner-plan/invocations"
  integration_http_method = "POST"
  passthrough_behavior    = "WHEN_NO_MATCH"
  timeout_milliseconds    = 29000
  cache_namespace         = "na23ga"
  cache_key_parameters    = []
}

resource "aws_api_gateway_deployment" "mp_rest_prod" {
  rest_api_id = aws_api_gateway_rest_api.mp_rest.id
  lifecycle {
    create_before_destroy = true
    ignore_changes        = [triggers]
  }
}

resource "aws_api_gateway_stage" "mp_rest_prod" {
  rest_api_id   = aws_api_gateway_rest_api.mp_rest.id
  stage_name    = "prod"
  deployment_id = aws_api_gateway_deployment.mp_rest_prod.id
}


# ============================================================================
# HTTP API: meal-planner-api (dmtezcygeb)
# ============================================================================

resource "aws_apigatewayv2_api" "mp_http" {
  name                         = "meal-planner-api"
  protocol_type                = "HTTP"
  route_selection_expression   = "$request.method $request.path"
  disable_execute_api_endpoint = false
}

resource "aws_apigatewayv2_stage" "mp_http_default" {
  api_id      = aws_apigatewayv2_api.mp_http.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "mp_http_kroger" {
  api_id                 = aws_apigatewayv2_api.mp_http.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:meal-planner-kroger"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "mp_http_nutrition" {
  api_id                 = aws_apigatewayv2_api.mp_http.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:meal-planner-nutrition/invocations"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "mp_http_kroger_products" {
  api_id    = aws_apigatewayv2_api.mp_http.id
  route_key = "GET /kroger/products"
  target    = "integrations/${aws_apigatewayv2_integration.mp_http_kroger.id}"
}

resource "aws_apigatewayv2_route" "mp_http_kroger_locations" {
  api_id    = aws_apigatewayv2_api.mp_http.id
  route_key = "GET /kroger/locations"
  target    = "integrations/${aws_apigatewayv2_integration.mp_http_kroger.id}"
}

resource "aws_apigatewayv2_route" "mp_http_nutrition" {
  api_id    = aws_apigatewayv2_api.mp_http.id
  route_key = "GET /nutrition"
  target    = "integrations/${aws_apigatewayv2_integration.mp_http_nutrition.id}"
}

# ============================================================================
# Lambda permissions (REST + HTTP APIs)
# ============================================================================

resource "aws_lambda_permission" "apigw_kroger_http" {
  statement_id  = "apigateway-invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.kroger.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${aws_apigatewayv2_api.mp_http.id}/*"
}

resource "aws_lambda_permission" "apigw_nutrition_http" {
  statement_id  = "apigw-nutrition"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.nutrition.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${aws_apigatewayv2_api.mp_http.id}/*/*/nutrition"
}

resource "aws_lambda_permission" "apigw_groups" {
  statement_id  = "apigateway-groups-any"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.groups.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${aws_api_gateway_rest_api.mp_rest.id}/*/*/groups"
}

resource "aws_lambda_permission" "apigw_share" {
  statement_id  = "apigateway-invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.share.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${aws_api_gateway_rest_api.mp_rest.id}/*/POST/share"
}

resource "aws_lambda_permission" "apigw_save_save" {
  statement_id  = "apigateway-invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.save.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${aws_api_gateway_rest_api.mp_rest.id}/*/POST/save"
}

resource "aws_lambda_permission" "apigw_save_import" {
  statement_id  = "apigateway-invoke-import"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.save.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${aws_api_gateway_rest_api.mp_rest.id}/*/POST/import"
}

resource "aws_lambda_permission" "apigw_save_cook" {
  statement_id  = "apigw-cook"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.save.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${aws_api_gateway_rest_api.mp_rest.id}/*/POST/cook"
}

resource "aws_lambda_permission" "apigw_plan" {
  statement_id  = "apigateway-plan-v2"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.plan.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${aws_api_gateway_rest_api.mp_rest.id}/*/POST/plan"
}

# ── feedback endpoint (HTTP API, unauthenticated) ─────────────────────────

resource "aws_apigatewayv2_integration" "mp_http_feedback" {
  api_id                 = aws_apigatewayv2_api.mp_http.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.feedback.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "mp_http_feedback_post" {
  api_id    = aws_apigatewayv2_api.mp_http.id
  route_key = "POST /feedback"
  target    = "integrations/${aws_apigatewayv2_integration.mp_http_feedback.id}"
}

resource "aws_apigatewayv2_route" "mp_http_feedback_options" {
  api_id    = aws_apigatewayv2_api.mp_http.id
  route_key = "OPTIONS /feedback"
  target    = "integrations/${aws_apigatewayv2_integration.mp_http_feedback.id}"
}

resource "aws_lambda_permission" "apigw_feedback" {
  statement_id  = "apigw-feedback"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.feedback.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${aws_apigatewayv2_api.mp_http.id}/*/*/feedback"
}