const core = require('../core');
const controllerUtils = core.controllerUtils;
const db = require('../database');
const model = require('../model');
const opportunityModel = model.opportunityModel;
const HTTP_CODES = core.HTTP_CODE;
const _ = require('lodash');

module.exports.calculate = async function (req, res, next) {
  // let date_from = controllerUtils.formatDate(req.body.object.date_from);
  // let date_to = controllerUtils.formatDate(req.body.object.date_to);
  let date_from = req.body.object.date_from;
  let date_to = req.body.object.date_to;
  let currency = req.body.object.currency;
  let show_by = req.body.object.showBy;
  let value = req.body.object.value;

  if (show_by == 'Currency') this.filterEUR = this.filterUSD = true;

  let query = `SELECT * FROM opportunities where `;
  // add date filter
  query += `created_at >= '${date_from}' and created_at<='${date_to}' `;
  // currency filter
  if (currency == 'ALL') {} else if (show_by != 'Currency') {
      if (currency == 'USD') query += `and currency like 'USD'`;
      if (currency == 'EUR') query += `and currency like 'EUR'`;
  }
  // order
  query += ` order by created_at`;

  let opportunities = await db.sequelize.query(query, {
      type: db.sequelize.QueryTypes.SELECT
  })

  let users = await getUsers();
  let companies = await getCompanies();
  let statuses = await getStatus();

  let result = calculate(opportunities, show_by, users, companies, statuses);
  return controllerUtils.responseHandler(res, true, "Get Opportunities Successfully ", result);  
};

module.exports.calculateV2 = async function (req, res, next) {
  // let date_from = controllerUtils.formatDate(req.body.object.date_from);
  //   let date_to = controllerUtils.formatDate(req.body.object.date_to);
  let date_from = req.body.object.date_from;
  let date_to = req.body.object.date_to;
  let currency = req.body.object.currency;
  let show_by = req.body.object.showBy;
  let by = req.body.object.by;
  let value = req.body.object.value;

  if (show_by == 'Currency' || by == 'Currency') this.filterEUR = this.filterUSD = true;

  let query = `SELECT * FROM opportunities where `;
  // add date filter
  query += `created_at >= '${date_from}' and created_at<='${date_to}' `;
  // currency filter
  if (currency == 'ALL') {} else if (show_by != 'Currency') {
      if (currency == 'USD') query += `and currency like 'USD'`;
      if (currency == 'EUR') query += `and currency like 'EUR'`;
  }
  // order
  query += ` order by created_at`;

  let opportunities = await db.sequelize.query(query, {
      type: db.sequelize.QueryTypes.SELECT
  })

  let users = await getUsers();
  let companies = await getCompanies();
  let statuses = await getStatus();

  // 
  if(show_by == by) {
      let data = calculate(opportunities, show_by, users, companies, statuses);
      let result = [{
          name: by,
          data: data
      }];
      return controllerUtils.responseHandler(res, true, "Get Calculation Successfully ", result);
      return;
  }

  let users_store = users.slice();
  let companies_store = companies.slice();
  let statuses_store = statuses.slice();

  let currencies = [];
  currencies.push({
      name: 'USD',
      opportunities: []
  });
  currencies.push({
      name: 'EUR',
      opportunities: []
  });

  for (let i = 0; i < users.length; i++) {
      let user = users[i];
      users[i] = {};
      users[i].id = user.id;
      users[i].name = user.username;
      users[i].opportunities = [];
  }
  for (let i = 0; i < companies.length; i++) {
      let company = companies[i];
      companies[i] = {};
      companies[i].id = company.id;
      companies[i].name = company.company_name;
      companies[i].opportunities = [];
  }
  for (let i = 0; i < statuses.length; i++) {
      statuses[i].opportunities = [];
  }

  months = [];
  years = []
  monthTemp = new Date(2000, 0, 1);
  yearTemp = new Date(2000, 0, 1);
  monthDataTemp = {
      name: "2000-1",
      opportunities: []
  }
  yearDataTemp = {
      name: "2000",
      opportunities: []
  }

  opportunities.forEach(function (opportunity) {
    // Currency
    if (opportunity.currency == 'USD') currencies[0].opportunities.push(opportunity);
    if (opportunity.currency == 'EUR') currencies[1].opportunities.push(opportunity);
    // User, Company, Statuses
    if (show_by == 'User') {
        for (var j = 0; j < users.length; j++) {
            if (opportunity.user_id == users[j].id) {
                users[j].opportunities.push(opportunity)
            }
        }
    }
    if (show_by == 'Company') {
        for (var j = 0; j < companies.length; j++) {
            if (opportunity.company_id == companies[j].id) {
                companies[j].opportunities.push(opportunity)
            }
        }
    }
    if (show_by == 'Status') {
        for (var j = 0; j < statuses.length; j++) {
            if (opportunity.status_id == statuses[j].id) {
                statuses[j].opportunities.push(opportunity)
            }
        }
    }

    //Data filter by month        
    var dateCreated = new Date(opportunity.created_at);
    if (show_by == 'Month') {
        if ((dateCreated.getFullYear() == monthTemp.getFullYear()) && (dateCreated.getMonth() == monthTemp.getMonth())) {
            monthDataTemp.opportunities.push(opportunity)
        } else {
            monthDataTemp = Object.assign({
                name: dateCreated.getFullYear() + "-" + (dateCreated.getMonth() + 1),
                opportunities: [opportunity]
            });
            months.push(monthDataTemp);
            monthTemp = dateCreated;
        }
    }
    //Data filter by year
    if (show_by == 'Year') {
        if ((dateCreated.getFullYear() == yearTemp.getFullYear())) {
            yearDataTemp.opportunities.push(opportunity);
        } else {
            yearDataTemp = Object.assign({
                name: dateCreated.getFullYear(),
                opportunities: [opportunity]
            });
            years.push(yearDataTemp);
            yearTemp = dateCreated;
        }
    }
  }, this);

  let result_v1;
  switch (show_by) {
      case 'User':
          result_v1 = users;
          break;
      case 'Company':
          result_v1 = companies;
          break;
      case 'Year':
          result_v1 = years;
          break;
      case 'Month':
          result_v1 = months;
          break;
      case 'Currency':
          result_v1 = currencies;
          break;
      case 'Status':
          result_v1 = statuses;
          break;
  }

  for(let i = 0 ; i < result_v1.length; i ++ ) {
      let result_v2 = calculate(result_v1[i].opportunities, by, users_store.slice(), companies_store.slice(), statuses_store.slice());
      delete result_v1[i].opportunities;
      result_v1[i].data = result_v2.map(e => Object.assign({}, e));
  }

  return controllerUtils.responseHandler(res, true, "Get Opportunities Successfully ", result_v1);
};

const getUsers = async() => {
  let users = await db.sequelize.query(`SELECT * FROM users`, {
      type: db.sequelize.QueryTypes.SELECT
  })
  return users;
}

const getStatus = async() => {
  let statuses = await db.sequelize.query(`SELECT * FROM statuses`, {
      type: db.sequelize.QueryTypes.SELECT
  });
  return statuses;
}

const getCompanies = async() => {
  let companies = await db.sequelize.query(`SELECT * FROM accounts`, {
      type: db.sequelize.QueryTypes.SELECT
  });
  return companies;
}

const calculate = (opportunities, show_by, users, companies, statuses) => {
  // console.log(opportunities, 'opportunities');
  let currencies = [];
  currencies.push({
      name: 'USD',
      count: 0
  });
  currencies.push({
      name: 'EUR',
      count: 0
  });

  for (let i = 0; i < users.length; i++) {
      let user = users[i];
      users[i].name = user.username;
      users[i].count = 0;
      users[i].sum = 0;
  }
  for (let i = 0; i < companies.length; i++) {
      let company = companies[i];
      companies[i] = {};
      companies[i].id = company.id;
      companies[i].name = company.company_name;
      companies[i].count = 0;
      companies[i].sum = 0;
  }
  for (let i = 0; i < statuses.length; i++) {      
      let status = statuses[i];
      statuses[i] = {};
      statuses[i].id = status.id;
      statuses[i].name = status.name;
      statuses[i].count = 0;
      statuses[i].sum = 0;
  }

  months = [];
  years = []
  monthTemp = new Date(2000, 0, 1);
  yearTemp = new Date(2000, 0, 1);
  monthDataTemp = {
      name: "2000-1",
      sum: 0,
      count: 0
  }
  yearDataTemp = {
      name: "2000",
      sum: 0,
      count: 0
  }
  // console.log(opportunities.length, 'opportunity length');
  opportunities.forEach(function (opportunity) {
      // Currency
      if (opportunity.currency == 'USD') currencies[0].count++;
      if (opportunity.currency == 'EUR') currencies[1].count++;
      // User, Company, Statuses
      if (show_by == 'User') {
          for (var j = 0; j < users.length; j++) {
              if (opportunity.user_id == users[j].id) {
                  users[j].sum += opportunity.value;
                  users[j].count++;
              }
          }
      }
      if (show_by == 'Company') {
          for (var j = 0; j < companies.length; j++) {
              if (opportunity.company_id == companies[j].id) {
                  companies[j].sum += opportunity.value;
                  companies[j].count++;
              }
          }
      }
      if (show_by == 'Status') {
          for (var j = 0; j < statuses.length; j++) {
              if (opportunity.status_id == statuses[j].id) {
                  statuses[j].sum += opportunity.value;
                  statuses[j].count++;
              }
          }
      }

      //Data filter by month        
      var dateCreated = new Date(opportunity.created_at);
      if (show_by == 'Month') {
          if ((dateCreated.getFullYear() == monthTemp.getFullYear()) && (dateCreated.getMonth() == monthTemp.getMonth())) {
              monthDataTemp.sum += opportunity.value;
              monthDataTemp.count++;
          } else {
              monthDataTemp = Object.assign({
                  name: dateCreated.getFullYear() + "-" + (dateCreated.getMonth() + 1),
                  sum: opportunity.value,
                  count: 1
              });
              months.push(monthDataTemp);
              monthTemp = dateCreated;
          }
      }
      //Data filter by year
      if (show_by == 'Year') {
          if ((dateCreated.getFullYear() == yearTemp.getFullYear())) {
              yearDataTemp.sum += opportunity.value;
              yearDataTemp.count++;
          } else {
              yearDataTemp = Object.assign({
                  name: dateCreated.getFullYear(),
                  sum: opportunity.value,
                  count: 1
              });
              years.push(yearDataTemp);
              yearTemp = dateCreated;
          }
      }
  }, this);

  let result;
  switch (show_by) {
      case 'User':
          result = users;
          break;
      case 'Company':
          result = companies;
          break;
      case 'Year':
          result = years;
          break;
      case 'Month':
          result = months;
          break;
      case 'Currency':
          result = currencies;
          break;
      case 'Status':
          result = statuses;
          break;
  }

  return result;
}
