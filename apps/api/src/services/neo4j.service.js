// Neo4j removed — all graph data lives in Postgres.
// This stub keeps any stale imports from crashing.

function isAvailable() { return false; }

async function createEntityNode(entityType, entityValue, entityId) {
  const d = getDriver();
  if (!d) return null;

  const session = d.session();
  try {
    const result = await session.run(
      `MERGE (e:Entity {entityId: $entityId})
       SET e.type = $entityType, e.value = $entityValue
       RETURN e`,
      { entityId, entityType, entityValue }
    );
    return result.records[0]?.get('e').properties;
  } finally {
    await session.close();
  }
}

async function createRelation(sourceId, relationType, targetId) {
  const d = getDriver();
  if (!d) return null;

  const session = d.session();
  try {
    const result = await session.run(
      `MATCH (a:Entity {entityId: $sourceId}), (b:Entity {entityId: $targetId})
       MERGE (a)-[r:RELATION {type: $relationType}]->(b)
       RETURN r`,
      { sourceId, relationType, targetId }
    );
    return result.records[0]?.get('r').properties;
  } finally {
    await session.close();
  }
}

async function clearCase(caseId) {
  const d = getDriver();
  if (!d) return;

  const session = d.session();
  try {
    await session.run(
      `MATCH (e:Entity {caseId: $caseId}) DETACH DELETE e`,
      { caseId }
    );
  } finally {
    await session.close();
  }
}

async function syncEntitiesAndRelations() {
  return { synced: false, reason: 'Neo4j removed' };

  const session = d.session();
  try {
    await session.run(`MATCH (e:Entity {caseId: $caseId}) DETACH DELETE e`, { caseId });

    for (const ent of entities) {
      await session.run(
        `CREATE (e:Entity {entityId: $id, type: $type, value: $value, caseId: $caseId})`,
        { id: ent.id, type: ent.entityType, value: ent.entityValue, caseId }
      );
    }

    for (const rel of relations) {
      await session.run(
        `MATCH (a:Entity {entityId: $src}), (b:Entity {entityId: $tgt})
         CREATE (a)-[:RELATION {type: $type, confidence: $conf}]->(b)`,
        { src: rel.sourceEntity, tgt: rel.targetEntity, type: rel.relationType, conf: rel.confidence }
      );
    }

    return { synced: true, nodeCount: entities.length, edgeCount: relations.length };
  } finally {
    await session.close();
  }
}

async function close() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

module.exports = {
  isAvailable,
  createEntityNode,
  createRelation,
  clearCase,
  syncEntitiesAndRelations,
  close,
};
