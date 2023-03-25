class XIV_WorldParser {
    constructor(server_data_file) {
        console.log(`Loading server names from ${server_data_file}...`)
        this.datacenter_server = fetchJSON(server_data_file);
        this.reverse_servers = {}
        for (const [datacenter, server_list] of Object.entries(this.datacenter_server)) {
            for (const server of server_list) {
                this.reverse_servers[server] = datacenter;
            }
        }
    }

    parse_charname(char_name) {
        const first_last = char_name.split(" ", maxsplit=1);
        let sn_idx = None;
        console.log(first_last);
        for (i in first_last[1]) {
            if (first_last[1][i].isupper()) {
                sn_idx = i;
            }
        }
        let last_name;
        let world_name;
        if (sn_idx) {
            last_name = first_last[1].slice(0, sn_idx);
            world_name = first_last[1].slice(sn_idx);
            if (!self.reverse_servers.keys().includes(world_name)) {
                last_name = first_last[1];
                world_name = None;
            }
        } else {
            last_name = first_last[1];
            world_name = None;
        }
        return (first_last[0], last_name, world_name);
    }
}