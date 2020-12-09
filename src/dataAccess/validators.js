exports.makeValidatorsDatabase = ({ makeDb }) => {
  return Object.freeze({
    findAll,
    findByUsername,
    updateByUsername,
    insert,
    removeByUsername
  })

  async function findAll(){
    const db = await makeDb();
    const result = await db.collection("validators").find();
    return result.toArray();
  }

  async function findByUsername(username){
    const db = await makeDb();
    const result = await db.collection("validators").find({ username });
    return result.toArray();
  }

  async function updateByUsername(username, data){
    const db = await makeDb();
    const result = await db.collection("validators").updateOne({ username: username }, { $set: { data } });
    return result.modifiedCount > 0 ? true : false
  }

  async function insert(data){
    const db = await makeDb();
    const result = await db.collection("validators").insert({ data });
    return result.toArray();
  }

  async function remove(username){
    const db = await makeDb();
    const result = await db.collection("validators").deleteOne({ username: username });
    return result.modifiedCount > 0 ? true : false
  }
}
