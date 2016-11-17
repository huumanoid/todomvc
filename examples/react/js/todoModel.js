/*jshint quotmark:false */
/*jshint white:false */
/*jshint trailing:false */
/*jshint newcap:false */
var app = app || {};

(function () {
	'use strict';

    var TODOS_URL = './todos';

    function http_todo_update(todo, cb) {
        const xhttp = new XMLHttpRequest();
        xhttp.open('PUT', TODOS_URL + '/' + todo.id, true);
        xhttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhttp.send(Utils.querystringify(todo));

        if (cb) {
            xhttp.onreadystatechange = cb.bind(xhttp, xhttp);
        }
    } 

    function http_todo_get_all(cb) {
        const xhttp = new XMLHttpRequest();
        xhttp.open('GET', TODOS_URL, true);
        xhttp.send();
        xhttp.onreadystatechange = cb.bind(xhttp, xhttp);
    }

    function http_todo_delete(todo, cb) {
        const xhttp = new XMLHttpRequest();
        xhttp.open('DELETE', TODOS_URL + '/' + todo.id, true);
        xhttp.send();
        if (cb) {
            xhttp.onreadystatechange = cb.bind(xhttp, xhttp);
        }
    }

    function http_todo_create(todo, cb) {
        const xhttp = new XMLHttpRequest();
        xhttp.open('POST', TODOS_URL, true);
        xhttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhttp.send(Utils.querystringify(todo));
        xhttp.onreadystatechange = cb.bind(xhttp, xhttp);
    }

	var Utils = app.Utils;
	// Generic "model" object. You can use whatever
	// framework you want. For this application it
	// may not even be worth separating this logic
	// out, but we do this to demonstrate one way to
	// separate out parts of your application.
	app.TodoModel = function (key) {
		this.key = key;
		this.todos = Utils.store(key);
		this.onChanges = [];

        http_todo_get_all((xhttp) => {
            if (xhttp.readyState === 4 && xhttp.status === 200) {
                const todos = JSON.parse(xhttp.responseText).response.todos;
                this.todos = todos;
                this.inform();
            }
        })

        this.socket = new WebSocket('ws://' + location.hostname +':8081');
        this.socket.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.update) {
                console.log(data)
                http_todo_get_all((xhttp) => {
                    if (xhttp.readyState === 4 && xhttp.status === 200) {
                        const todos = JSON.parse(xhttp.responseText).response.todos;
                        this.todos = todos;
                        this.inform();
                    }
                })
            }
        }
	};

	app.TodoModel.prototype.subscribe = function (onChange) {
		this.onChanges.push(onChange);
	};

	app.TodoModel.prototype.inform = function () {
		Utils.store(this.key, this.todos);
		this.onChanges.forEach(function (cb) { cb(); });
	};

	app.TodoModel.prototype.addTodo = function (title) {
        const newTodo = {
			id: Utils.uuid(),
			title: title,
			completed: false,
            local: true,
            deleted: false
		};
		this.todos = this.todos.concat(newTodo);

        http_todo_create(newTodo, (xhttp) => {
            if (xhttp.readyState === 4 && (xhttp.status === 200 
                        || xhttp.status === 201)) {

                newTodo.local = false;

                const response = JSON.parse(xhttp.responseText).response;

                this.todos = this.todos.map(function (todo) {
                    return todo !== newTodo ?
                        todo :
                        Utils.extend({}, newTodo, { id: response.id });
                });

                this.inform();
            }
        });

		this.inform();
	};

	app.TodoModel.prototype.toggleAll = function (checked) {
		// Note: it's usually better to use immutable data structures since they're
		// easier to reason about and React works very well with them. That's why
		// we use map() and filter() everywhere instead of mutating the array or
		// todo items themselves.
		this.todos = this.todos.map(function (todo) {
			return Utils.extend({}, todo, {completed: checked});
		});

		this.inform();
	};

	app.TodoModel.prototype.toggle = function (todoToToggle) {
        const toggledTodo = Utils.extend({}, todoToToggle, {completed: !todoToToggle.completed})
		this.todos = this.todos.map(function (todo) {
			return todo !== todoToToggle ?
				todo :
                toggledTodo;
		});

        http_todo_update(toggledTodo);

		this.inform();
	};

	app.TodoModel.prototype.destroy = function (todo) {
		this.todos = this.todos.filter(function (candidate) {
			return candidate !== todo;
		});

        http_todo_delete(todo);

		this.inform();
	};

	app.TodoModel.prototype.save = function (todoToSave, text) {
        const alteredTodo = Utils.extend({}, todoToSave, {title: text});

		this.todos = this.todos.map(function (todo) {
			return todo !== todoToSave ? 
                todo : 
                alteredTodo;
		});

        http_todo_update(alteredTodo);

		this.inform();
	};

	app.TodoModel.prototype.clearCompleted = function () {
		this.todos = this.todos.filter(function (todo) {
            if (todo.completed) {
                http_todo_delete(todo);
                return true;
            }
            return false;
		});

		this.inform();
	};

})();
