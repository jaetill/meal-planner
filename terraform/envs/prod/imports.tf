import {
  to = aws_secretsmanager_secret.main
  id = "arn:aws:secretsmanager:us-east-2:214599503944:secret:meal-planner/secrets-WnfBUU"
}

import {
  to = aws_cloudwatch_log_group.groups
  id = "/aws/lambda/meal-planner-groups"
}

import {
  to = aws_cloudwatch_log_group.kroger
  id = "/aws/lambda/meal-planner-kroger"
}

import {
  to = aws_cloudwatch_log_group.nutrition
  id = "/aws/lambda/meal-planner-nutrition"
}

import {
  to = aws_cloudwatch_log_group.plan
  id = "/aws/lambda/meal-planner-plan"
}

import {
  to = aws_cloudwatch_log_group.share
  id = "/aws/lambda/meal-planner-share"
}

import {
  to = aws_cloudwatch_log_group.save
  id = "/aws/lambda/MealPlannerSave"
}