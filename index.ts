import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as pulumi from '@pulumi/pulumi';

const stack = pulumi.getStack();
const cluster = new aws.ecs.Cluster(`test-cluster-${stack}`, {});

const defaultVpc = new awsx.ec2.DefaultVpc('default-vpc');

export const serverTg = pulumi.Output.create(new aws.lb.TargetGroup(`test-server-tg-${stack}`, {
  vpcId: defaultVpc.vpcId,
  port: 80,
  protocol: 'HTTP',
  targetType: 'ip',
  protocolVersion: 'HTTP1',
}));

const lb = new awsx.lb.ApplicationLoadBalancer(`test-lb-${stack}`, {});

new aws.alb.Listener('test-listener', {
  loadBalancerArn: lb.loadBalancer.arn,
  port: 443,
  protocol: 'HTTP',
  defaultActions: [{
    type: 'forward',
    targetGroupArn: serverTg.arn,
  }],
});

const serviceSg = new aws.ec2.SecurityGroup(`test-service-sg-${stack}`, {
  ingress: [
    {
      protocol: '-1',
      fromPort: 0,
      toPort: 0,
      cidrBlocks: ['0.0.0.0/0'],
    },
  ],
});

new awsx.ecs.FargateService(`test-server-service-${stack}`, {
  cluster: cluster.arn,
  networkConfiguration: {
    assignPublicIp: true,
    securityGroups: [serviceSg.id],
    subnets: defaultVpc.publicSubnetIds,
  },
  taskDefinitionArgs: {
    container: {
      name: 'server',
      image: 'nginx:stable',
      cpu: 1024,
      memory: 4 * 1024,
      essential: true,
      portMappings: [
        { targetGroup: serverTg },
      ],
    },
  },
});

export const url = lb.loadBalancer.arn;
