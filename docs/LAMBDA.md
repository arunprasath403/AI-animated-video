# Render on AWS Lambda (optional)

Local rendering is free and needs no cloud account. Lambda is useful when you want many videos rendered in parallel.

> Status: the Lambda path uses the HyperFrames Lambda renderer and has not yet been tested end to end with this project. Local rendering is fully tested.

1. Configure AWS credentials: `aws configure`.
2. Deploy the renderer stack once:
   ```bash
   c2v lambda-deploy
   ```
3. Render any plan on Lambda:
   ```bash
   c2v make plans/what-is-rag.json --lambda
   ```

The region and stack name are set in `c2v.config.json` (`lambda.region`, `lambda.stackName`). The finished MP4 goes to the S3 bucket the deploy created, and the CLI prints its path.

**Cost.** The AWS Lambda free tier includes 400,000 GB-seconds of compute per month, which covers a lot of short renders. S3 storage and data transfer have their own small free allowances. Check your AWS billing dashboard; usage beyond the free tier is billed by AWS.
