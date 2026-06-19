import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

export class Tenant extends Model<
  InferAttributes<Tenant>,
  InferCreationAttributes<Tenant>
> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare createdAt: CreationOptional<Date>;
  declare rateLimitPerMinute: CreationOptional<number>;
}

export class ApiKey extends Model<
  InferAttributes<ApiKey>,
  InferCreationAttributes<ApiKey>
> {
  declare id: CreationOptional<number>;
  declare tenantId: string;
  declare keyId: string;
  declare keySecretHash: string;
  declare status: 'ACTIVE' | 'REVOKED';
  declare createdAt: CreationOptional<Date>;
}

export class JobDefinition extends Model<
  InferAttributes<JobDefinition>,
  InferCreationAttributes<JobDefinition>
> {
  declare id: CreationOptional<number>;
  declare tenantId: string;
  declare name: string;
  declare cronExpression: string;
  declare targetUrl: string;
  declare status: 'ACTIVE' | 'PAUSED';
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class ExecutionRecord extends Model<
  InferAttributes<ExecutionRecord>,
  InferCreationAttributes<ExecutionRecord>
> {
  declare executionId: string;
  declare jobId: string;
  declare tenantId: string;
  declare targetUrl: string;
  declare triggeredAt: Date;
  declare attempt: number;
  declare status: 'PENDING' | 'RETRY_PENDING' | 'SUCCESS' | 'DLQ';
  declare nextAttemptAt: Date | null;
  declare lastError: string | null;
  declare lastStatusCode: number | null;
  declare lastLatencyMs: number | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initModels(sequelize: Sequelize): void {
  Tenant.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      rateLimitPerMinute: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 120,
        field: 'rate_limit_per_minute',
      },
    },
    { sequelize, tableName: 'tenant', timestamps: false, underscored: false },
  );

  ApiKey.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
      keyId: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'key_id' },
      keySecretHash: {
        type: DataTypes.STRING(256),
        allowNull: false,
        field: 'key_secret_hash',
      },
      status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'ACTIVE' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    },
    { sequelize, tableName: 'api_key', timestamps: false, underscored: false },
  );

  JobDefinition.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
      name: { type: DataTypes.STRING(140), allowNull: false },
      cronExpression: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: 'cron_expression',
      },
      targetUrl: { type: DataTypes.STRING(1000), allowNull: false, field: 'target_url' },
      status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'ACTIVE' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    },
    { sequelize, tableName: 'job_definition', timestamps: false, underscored: false },
  );

  ExecutionRecord.init(
    {
      executionId: {
        type: DataTypes.STRING(64),
        primaryKey: true,
        field: 'execution_id',
      },
      jobId: { type: DataTypes.STRING(64), allowNull: false, field: 'job_id' },
      tenantId: { type: DataTypes.STRING(64), allowNull: false, field: 'tenant_id' },
      targetUrl: { type: DataTypes.STRING(1000), allowNull: false, field: 'target_url' },
      triggeredAt: { type: DataTypes.DATE, allowNull: false, field: 'triggered_at' },
      attempt: { type: DataTypes.INTEGER, allowNull: false },
      status: { type: DataTypes.STRING(24), allowNull: false },
      nextAttemptAt: { type: DataTypes.DATE, allowNull: true, field: 'next_attempt_at' },
      lastError: { type: DataTypes.STRING(2000), allowNull: true, field: 'last_error' },
      lastStatusCode: { type: DataTypes.INTEGER, allowNull: true, field: 'last_status_code' },
      lastLatencyMs: { type: DataTypes.BIGINT, allowNull: true, field: 'last_latency_ms' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    },
    { sequelize, tableName: 'execution_record', timestamps: false, underscored: false },
  );

  Tenant.hasMany(ApiKey, { foreignKey: 'tenantId', as: 'apiKeys' });
  ApiKey.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  Tenant.hasMany(JobDefinition, { foreignKey: 'tenantId', as: 'jobs' });
  JobDefinition.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
}

let sequelizeInstance: Sequelize | null = null;

export async function getSequelize(databaseUrl: string): Promise<Sequelize> {
  if (sequelizeInstance) return sequelizeInstance;

  sequelizeInstance = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
    define: { underscored: false },
  });

  initModels(sequelizeInstance);
  await sequelizeInstance.authenticate();
  return sequelizeInstance;
}

export async function closeSequelize(): Promise<void> {
  if (sequelizeInstance) {
    await sequelizeInstance.close();
    sequelizeInstance = null;
  }
}

export async function withTransaction<T>(
  sequelize: Sequelize,
  fn: (transaction: import('sequelize').Transaction) => Promise<T>,
): Promise<T> {
  return sequelize.transaction(fn);
}
